// Runs every 5 minutes via Vercel Cron (configured in vercel.json).
// Atomically claims a batch of due scheduled_messages, sends them in parallel,
// and updates status. The "processing" claim prevents an overlapping cron run
// from double-sending the same message.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate, sendText } from "@/lib/whatsapp/client";
import { sendText as greenSendText } from "@/lib/whatsapp/green-api";
import { sendText as evolutionSendText } from "@/lib/whatsapp/evolution-api";
import { renderTemplateText, type TemplateKey } from "@/lib/whatsapp/templates";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 50;

type DueMessage = {
  id: string;
  clinic_id: string;
  patient_id: string;
  template_key: string;
  template_vars: string[] | null;
  attempts: number;
  scheduled_for: string;
  patients: { phone: string | null; first_name: string | null } | null;
  clinics: { settings: Record<string, string> | null } | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // 1. Select due ids
  const { data: candidates, error: selErr } = await supabase
    .from("scheduled_messages")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(BATCH);

  if (selErr) {
    console.error("[cron] select error:", selErr);
    return Response.json({ error: selErr.message }, { status: 500 });
  }
  if (!candidates?.length) return Response.json({ sent: 0, failed: 0 });

  const ids = candidates.map((c) => c.id);

  // 2. Atomically claim: only rows still 'pending' flip to 'processing' and return.
  //    A concurrent run won't re-claim these.
  const { data: claimed } = await supabase
    .from("scheduled_messages")
    .update({ status: "processing" })
    .in("id", ids)
    .eq("status", "pending")
    .select("*, patients(phone, first_name), clinics(settings)");

  if (!claimed?.length) return Response.json({ sent: 0, failed: 0 });

  // 3. Send in parallel (bounded by BATCH size).
  const results = await Promise.allSettled(
    (claimed as DueMessage[]).map((msg) => sendOne(supabase, msg, now))
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.length - sent;

  console.log(`[cron/send-messages] sent=${sent} failed=${failed}`);
  return Response.json({ sent, failed });
}

async function sendOne(supabase: SupabaseClient, msg: DueMessage, now: string): Promise<boolean> {
  const phone = msg.patients?.phone;
  const settings = msg.clinics?.settings;
  const phoneNumberId = settings?.wa_phone_number_id;
  const accessToken = settings?.wa_access_token;
  const greenId = settings?.green_id_instance;
  const greenToken = settings?.green_api_token;
  const evolutionHost = settings?.evolution_host;
  const evolutionInstance = settings?.evolution_instance;
  const evolutionKey = settings?.evolution_api_key;

  const hasMeta = !!phoneNumberId && !!accessToken;
  const hasGreen = !!greenId && !!greenToken;
  const hasEvolution = !!evolutionHost && !!evolutionInstance && !!evolutionKey;

  if (!phone || (!hasMeta && !hasGreen && !hasEvolution)) {
    await supabase
      .from("scheduled_messages")
      .update({ status: "failed", last_error: "missing phone or WhatsApp credentials" })
      .eq("id", msg.id);
    return false;
  }

  try {
    const vars = msg.template_vars ?? [];
    let waId: string;

    if (hasEvolution) {
      // Evolution API (Baileys) — send rendered free text (no approved templates needed)
      const text = renderTemplateText(msg.template_key, vars);
      waId = await evolutionSendText(
        { host: evolutionHost!, instance: evolutionInstance!, apiKey: evolutionKey! },
        phone,
        text
      );
    } else if (hasGreen) {
      // Green API has no approved templates — always send rendered free text.
      const text = renderTemplateText(msg.template_key, vars);
      waId = await greenSendText({ idInstance: greenId!, apiToken: greenToken! }, phone, text);
    } else {
      // free_text: vars[0] is the raw message body (used inside the 24h service window)
      waId = msg.template_key === "free_text"
        ? await sendText({ phoneNumberId: phoneNumberId!, accessToken: accessToken! }, phone, vars[0] ?? "")
        : await sendTemplate({ phoneNumberId: phoneNumberId!, accessToken: accessToken! }, phone, msg.template_key as TemplateKey, vars);
    }

    await supabase
      .from("scheduled_messages")
      .update({ status: "sent", attempts: (msg.attempts ?? 0) + 1 })
      .eq("id", msg.id);

    await recordOutbound(supabase, msg, phone, waId, now);
    return true;
  } catch (e) {
    const errMsg = String(e);
    const attempts = (msg.attempts ?? 0) + 1;
    await supabase
      .from("scheduled_messages")
      .update({
        attempts,
        last_error: errMsg,
        // Retry up to 3 times with a 10-minute backoff; otherwise give up.
        status: attempts >= 3 ? "failed" : "pending",
        scheduled_for: attempts < 3 ? new Date(Date.now() + 10 * 60_000).toISOString() : msg.scheduled_for,
      })
      .eq("id", msg.id);
    console.error(`[cron] send failed for ${msg.id}:`, errMsg);
    return false;
  }
}

async function recordOutbound(
  supabase: SupabaseClient,
  msg: DueMessage,
  phone: string,
  waId: string,
  now: string
) {
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("clinic_id", msg.clinic_id)
    .eq("patient_id", msg.patient_id)
    .neq("status", "closed")
    .limit(1)
    .maybeSingle();

  const convId =
    conv?.id ??
    (
      await supabase
        .from("conversations")
        .insert({
          clinic_id: msg.clinic_id,
          patient_id: msg.patient_id,
          channel: "whatsapp",
          wa_contact: phone,
          status: "bot",
          last_message_at: now,
        })
        .select("id")
        .single()
    ).data?.id;

  if (convId) {
    await supabase.from("messages").insert({
      conversation_id: convId,
      direction: "outbound",
      template_key: msg.template_key,
      wa_message_id: waId || null,
      status: "sent",
      sent_at: now,
    });
  }
}
