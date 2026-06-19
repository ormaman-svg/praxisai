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

const MEDIA_TYPE_MAP: Record<string, "image" | "video" | "audio" | "document"> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
};

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac",
  "application/pdf": "pdf",
};

// Green API (unofficial, free) inbound webhook — supports text + video/image/audio/document.
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

  if (payload?.typeWebhook !== "incomingMessageReceived") {
    return Response.json({ ok: true });
  }

  const idInstance = String(
    payload?.instanceData?.idInstance ?? payload?.instanceData?.wid ?? ""
  ).replace(/\D/g, "");
  const chatId: string = payload?.senderData?.chatId ?? "";
  const md = payload?.messageData ?? {};
  const waMessageId: string = payload?.idMessage ?? "";

  // Group chats are ignored.
  if (!chatId.endsWith("@c.us") || !idInstance) {
    return Response.json({ ok: true });
  }

  const supabase = createAdminClient();

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
  if (!patient) return Response.json({ ok: true });

  const conversationId = await getOrCreateConversation(supabase, clinic.id, patient.id, contact);
  if (!conversationId) return Response.json({ ok: true });

  // ── Detect message type ──────────────────────────────────────────────────
  const typeMessage: string = md?.typeMessage ?? "";
  const isText = typeMessage === "textMessage" || typeMessage === "extendedTextMessage";
  const mediaCategory = MEDIA_TYPE_MAP[typeMessage];

  const text: string =
    md?.textMessageData?.textMessage ??
    md?.extendedTextMessageData?.text ??
    "";

  // ── Handle media (video / image / audio / document) ──────────────────────
  let persistedMediaUrl: string | null = null;
  let persistedMediaType: string | null = null;
  let body: string | null = text.trim() || null;

  if (mediaCategory) {
    const fileData = md?.fileMessageData ?? {};
    const downloadUrl: string = fileData?.downloadUrl ?? "";
    const mimeType: string = fileData?.mimeType ?? "";
    const caption: string = (fileData?.caption ?? "").trim();

    persistedMediaType = mediaCategory;
    body = caption || null;

    if (downloadUrl) {
      try {
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const resolvedMime = res.headers.get("content-type") ?? mimeType;
          const ext = MIME_EXT[resolvedMime] ?? MIME_EXT[mimeType] ?? "bin";
          const storagePath = `${clinic.id}/${waMessageId}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("whatsapp-media")
            .upload(storagePath, buffer, { contentType: resolvedMime || mimeType, upsert: false });
          if (!uploadErr) persistedMediaUrl = storagePath;
        }
      } catch (e) {
        console.error("[green] media download failed:", e);
      }
    }
  } else if (!isText) {
    // Unknown message type (sticker, location, poll…) — ignore silently.
    return Response.json({ ok: true });
  }

  // ── Persist message ──────────────────────────────────────────────────────
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
  await supabase.from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Media-only (no caption) → store + escalate to human so therapist can review.
  if (!body) {
    await supabase.from("conversations").update({ status: "human" }).eq("id", conversationId);
    notifyEscalation({
      clinicId: clinic.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      reason: "media",
    });
    return Response.json({ ok: true });
  }

  // ── Opt-out keywords ─────────────────────────────────────────────────────
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

  // ── Run AI agent ─────────────────────────────────────────────────────────
  const ctx = { conversationId, contact, contactPhone: contact, clinicId: clinic.id, patient: patient as PatientLite };
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
