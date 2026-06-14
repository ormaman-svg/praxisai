// Runs every 5 minutes via Vercel Cron (configured in vercel.json).
// Picks up pending scheduled_messages, sends them via WhatsApp, updates status.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/client";
import type { TemplateKey } from "@/lib/whatsapp/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  // Protect against non-Vercel callers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Fetch up to 50 due messages
  const { data: due, error } = await supabase
    .from("scheduled_messages")
    .select("*, patients(phone, first_name), clinics(settings)")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(50);

  if (error) {
    console.error("[cron/send-messages] fetch error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0, failed = 0;

  for (const msg of due ?? []) {
    const phone = (msg.patients as { phone: string | null } | null)?.phone;
    const settings = (msg.clinics as { settings: Record<string, string> | null } | null)?.settings;
    const phoneId = settings?.wa_phone_id;
    const apiKey = settings?.wa_api_key;

    if (!phone || !phoneId || !apiKey) {
      await supabase
        .from("scheduled_messages")
        .update({ status: "failed", last_error: "missing phone or WhatsApp credentials" })
        .eq("id", msg.id);
      failed++;
      continue;
    }

    try {
      const vars: string[] = (msg.template_vars as string[] | null) ?? [];
      const waId = await sendTemplate(
        { phoneId, apiKey },
        phone,
        msg.template_key as TemplateKey,
        vars
      );

      await supabase
        .from("scheduled_messages")
        .update({ status: "sent", attempts: (msg.attempts ?? 0) + 1 })
        .eq("id", msg.id);

      // Record in messages table for inbox visibility
      // Find or create conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("clinic_id", msg.clinic_id)
        .eq("patient_id", msg.patient_id)
        .neq("status", "closed")
        .limit(1)
        .single();

      const convId = conv?.id ?? (await supabase
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

      sent++;
    } catch (e) {
      const errMsg = String(e);
      const newAttempts = (msg.attempts ?? 0) + 1;
      await supabase
        .from("scheduled_messages")
        .update({
          attempts: newAttempts,
          last_error: errMsg,
          // Give up after 3 attempts
          status: newAttempts >= 3 ? "failed" : "pending",
          // Back off: retry in 10 minutes
          scheduled_for: newAttempts < 3
            ? new Date(Date.now() + 10 * 60_000).toISOString()
            : msg.scheduled_for,
        })
        .eq("id", msg.id);
      console.error(`[cron] failed to send message ${msg.id}:`, errMsg);
      failed++;
    }
  }

  console.log(`[cron/send-messages] sent=${sent} failed=${failed}`);
  return Response.json({ sent, failed });
}
