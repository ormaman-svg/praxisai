// Evolution API (Baileys-based) inbound webhook.
// Configure this URL in the Evolution API console as the instance webhook:
//   https://<your-domain>/api/whatsapp/evolution
//
// Optional shared-secret check: set EVOLUTION_WEBHOOK_TOKEN and append ?token=... to the URL.

import { createAdminClient } from "@/lib/supabase/admin";
import { findPatientByPhone } from "@/lib/whatsapp/normalize";
import { sendText, chatIdToPhone, type EvolutionCreds } from "@/lib/whatsapp/evolution-api";
import { notifyEscalation } from "@/lib/notifications/escalation";
import {
  getOrCreateConversation,
  acquireLock,
  releaseLock,
  processConversation,
  type PatientLite,
} from "@/lib/whatsapp/agent";

export const dynamic = "force-dynamic";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/opus": "ogg", "audio/aac": "aac",
  "application/pdf": "pdf",
};

type MediaKey = "imageMessage" | "videoMessage" | "audioMessage" | "documentMessage";
const MEDIA_KEY_TYPE: Record<MediaKey, "image" | "video" | "audio" | "document"> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (expected && url.searchParams.get("token") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Only handle inbound messages
  if (payload?.event !== "messages.upsert") return Response.json({ ok: true });

  const instanceName: string = payload?.instance ?? "";
  const data = payload?.data ?? {};
  const key = data?.key ?? {};

  // Ignore outbound echoes
  if (key?.fromMe === true) return Response.json({ ok: true });

  const remoteJid: string = key?.remoteJid ?? "";
  const waMessageId: string = key?.id ?? "";

  // Ignore group chats
  if (!remoteJid.endsWith("@s.whatsapp.net") || !instanceName) {
    return Response.json({ ok: true });
  }

  const contact = chatIdToPhone(remoteJid);
  const message = data?.message ?? {};

  // Extract text
  const text: string =
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    "";

  // Detect media
  const mediaKey = (Object.keys(MEDIA_KEY_TYPE) as MediaKey[]).find((k) => !!message[k]);
  const mediaObj = mediaKey ? (message[mediaKey] as Record<string, string>) : null;
  const mediaUrl: string = data?.mediaUrl ?? ""; // set when Evolution has S3 configured
  const mimeType: string = mediaObj?.mimetype ?? mediaObj?.mimeType ?? "";
  const base64Media: string = mediaObj?.base64 ?? ""; // fallback if no S3

  const supabase = createAdminClient();

  // Route to the clinic that owns this Evolution instance
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, settings")
    .eq("settings->>evolution_instance", instanceName)
    .limit(1)
    .maybeSingle();

  if (!clinic) return Response.json({ ok: true });

  const creds: EvolutionCreds = {
    host: clinic.settings?.evolution_host ?? "",
    apiKey: clinic.settings?.evolution_api_key ?? "",
    instance: instanceName,
  };
  if (!creds.host || !creds.apiKey) return Response.json({ ok: true });

  const patient = await findPatientByPhone(supabase, clinic.id, contact);
  // Unknown senders still get a conversation so the clinic can see who messaged them;
  // we just skip AI processing for them.

  const conversationId = await getOrCreateConversation(supabase, clinic.id, patient?.id ?? null, contact);
  if (!conversationId) return Response.json({ ok: true });

  // ── Persist inbound message ──────────────────────────────────────────────

  let persistedMediaUrl: string | null = null;
  let persistedMediaType: string | null = null;
  let body: string | null = text.trim() || null;

  if (mediaKey) {
    persistedMediaType = MEDIA_KEY_TYPE[mediaKey];
    try {
      let mediaBuffer: ArrayBuffer | null = null;
      let resolvedMime = mimeType;

      if (mediaUrl) {
        // Evolution has S3 configured — download from URL
        const res = await fetch(mediaUrl);
        if (res.ok) {
          mediaBuffer = await res.arrayBuffer();
          resolvedMime = res.headers.get("content-type") ?? mimeType;
        }
      } else if (base64Media) {
        // No S3 — Evolution sent base64 in the webhook body
        const bin = Uint8Array.from(atob(base64Media), (c) => c.charCodeAt(0));
        mediaBuffer = bin.buffer;
      }

      if (mediaBuffer) {
        const ext = MIME_EXT[resolvedMime] ?? "bin";
        const storagePath = `${clinic.id}/${waMessageId}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("whatsapp-media")
          .upload(storagePath, mediaBuffer, { contentType: resolvedMime, upsert: false });
        if (!uploadErr) persistedMediaUrl = storagePath;
      }
    } catch (e) {
      console.error("[evolution] media store failed:", e);
    }

    // Caption for media messages
    body = (mediaObj?.caption ?? "").trim() || null;
  }

  // Dedup via wa_message_id unique constraint
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    body,
    media_url: persistedMediaUrl,
    media_type: persistedMediaType,
    wa_message_id: waMessageId || null,
    status: "delivered",
    sent_at: new Date().toISOString(),
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Media-only → escalate to human
  if (!body) {
    await supabase.from("conversations").update({ status: "human" }).eq("id", conversationId);
    notifyEscalation({
      clinicId: clinic.id,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : contact,
      reason: "media",
    });
    return Response.json({ ok: true });
  }

  // Opt-out keywords
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

  // Process conversation with the AI agent (known patients only)
  if (patient) {
    const gotLock = await acquireLock(supabase, conversationId);
    if (gotLock) {
      try {
        await processConversation(
          supabase,
          { conversationId, contact, clinicId: clinic.id, patient: patient as PatientLite },
          (to, t) => sendText(creds, to, t)
        );
      } catch (e) {
        console.error("[evolution] processing error:", e);
      } finally {
        await releaseLock(supabase, conversationId);
      }
    }
  } else {
    // Unknown sender — escalate so a human sees the message
    await supabase.from("conversations").update({ status: "human" }).eq("id", conversationId);
  }

  return Response.json({ ok: true });
}
