import { createAdminClient } from "@/lib/supabase/admin";
import { findPatientByPhone } from "@/lib/whatsapp/normalize";
import { sendText, chatIdToPhone, type GreenCreds } from "@/lib/whatsapp/green-api";
import { notifyEscalation } from "@/lib/notifications/escalation";
import {
  getOrCreateConversation,
  acquireLock,
  releaseLock,
  processConversation,
  type PatientLite,
} from "@/lib/whatsapp/agent";

export const dynamic = "force-dynamic";

// Green API (unofficial, free) inbound webhook.
// Configure this URL in the Green API console as the instance webhook:
//   https://<your-domain>/api/whatsapp/green
//
// Optional shared-secret check: set GREEN_WEBHOOK_TOKEN and append ?token=... to the URL.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.GREEN_WEBHOOK_TOKEN;
  if (expected && url.searchParams.get("token") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // We only act on inbound text messages; ack everything else.
  if (payload?.typeWebhook !== "incomingMessageReceived") {
    return Response.json({ ok: true });
  }

  const idInstance = String(
    payload?.instanceData?.idInstance ?? payload?.instanceData?.wid ?? ""
  ).replace(/\D/g, "");
  const chatId: string = payload?.senderData?.chatId ?? "";
  const md = payload?.messageData ?? {};
  const waMessageId: string = payload?.idMessage ?? "";

  // Extract text across the common Green message shapes.
  const text: string =
    md?.textMessageData?.textMessage ??
    md?.extendedTextMessageData?.text ??
    "";

  // Group chats (@g.us) and non-text messages are ignored by the bot.
  if (!chatId.endsWith("@c.us") || !idInstance) {
    return Response.json({ ok: true });
  }

  const supabase = createAdminClient();

  // Route to the clinic that owns this Green instance.
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, settings")
    .eq("settings->>green_id_instance", idInstance)
    .limit(1)
    .maybeSingle();

  if (!clinic) return Response.json({ ok: true });

  const apiToken = clinic.settings?.green_api_token;
  if (!apiToken) return Response.json({ ok: true });

  const creds: GreenCreds = { idInstance, apiToken };
  const contact = chatIdToPhone(chatId);

  const patient = await findPatientByPhone(supabase, clinic.id, contact);
  if (!patient) return Response.json({ ok: true }); // do not engage unknown senders

  const conversationId = await getOrCreateConversation(supabase, clinic.id, patient.id, contact);
  if (!conversationId) return Response.json({ ok: true });

  // Non-text (media) → persist a placeholder and escalate to a human.
  if (!text.trim()) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "inbound",
      body: "[מדיה]",
      wa_message_id: waMessageId || null,
      status: "delivered",
      sent_at: new Date().toISOString(),
    });
    await supabase.from("conversations")
      .update({ status: "human", last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
    notifyEscalation({
      clinicId: clinic.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      reason: "media",
    });
    return Response.json({ ok: true });
  }

  const body = text.trim();

  // Persist inbound (unique wa_message_id dedups Green retries).
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    body,
    wa_message_id: waMessageId || null,
    status: "delivered",
    sent_at: new Date().toISOString(),
  });
  await supabase.from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Opt-out keywords short-circuit the bot.
  const lower = body.toLowerCase();
  if (["stop", "עצור", "הסר", "בטל רישום"].some((k) => lower.includes(k))) {
    await supabase.from("patient_consents").upsert({
      patient_id: patient.id,
      channel: "whatsapp",
      opted_in: false,
      source: "reply_stop",
      consented_at: new Date().toISOString(),
    });
    await sendText(creds, contact, "הוסרת מרשימת ההתראות. שלחו START בכל עת לחידוש.");
    return Response.json({ ok: true });
  }

  // Serialize processing per-conversation with a lease lock.
  const ctx = { conversationId, contact, clinicId: clinic.id, patient: patient as PatientLite };
  const gotLock = await acquireLock(supabase, conversationId);
  if (gotLock) {
    try {
      await processConversation(supabase, ctx, (to, t) => sendText(creds, to, t));
    } catch (e) {
      console.error("[green] processing error:", e);
    } finally {
      await releaseLock(supabase, conversationId);
    }
  }

  return Response.json({ ok: true });
}
