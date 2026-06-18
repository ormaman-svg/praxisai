// Evolution API (Baileys-based) inbound webhook.
// Configure this URL in the Evolution API console as the instance webhook:
//   https://<your-domain>/api/whatsapp/evolution
//
// Optional shared-secret check: set EVOLUTION_WEBHOOK_TOKEN and append ?token=... to the URL.

import { createAdminClient } from "@/lib/supabase/admin";
import { findPatientByPhone, normalizePhone } from "@/lib/whatsapp/normalize";
import { sendText, toChatId, chatIdToPhone, getMediaBase64, type EvolutionCreds } from "@/lib/whatsapp/evolution-api";
import { notifyEscalation } from "@/lib/notifications/escalation";
import { encryptMessage } from "@/lib/crypto/messages";
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

  console.log("[evolution] webhook event:", payload?.event, "instance:", payload?.instance);

  // Only handle inbound messages
  if (payload?.event !== "messages.upsert") return Response.json({ ok: true });

  const instanceName: string = payload?.instance ?? "";
  const data = payload?.data ?? {};
  const key = data?.key ?? {};

  // Ignore outbound echoes
  if (key?.fromMe === true) return Response.json({ ok: true });

  const remoteJid: string = key?.remoteJid ?? "";
  const waMessageId: string = key?.id ?? "";

  // Newer Evolution/Baileys versions expose the real phone JID alongside an @lid
  // remoteJid (the @lid digits are an internal id, NOT a phone number).
  // We probe every field name that has carried it across versions.
  const senderPnJid: string =
    key?.senderPn ?? key?.remoteJidAlt ?? data?.senderPn ?? data?.remoteJidAlt ?? "";

  console.log("[evolution] remoteJid:", remoteJid, "senderPn:", senderPnJid, "key:", JSON.stringify(key), "fromMe:", key?.fromMe);

  // Ignore group chats and broadcasts; accept individual @s.whatsapp.net and @lid (newer WA format)
  const isIndividual = remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
  if (!isIndividual || !instanceName) {
    console.log("[evolution] skipping — group/broadcast or no instance. jid:", remoteJid);
    return Response.json({ ok: true });
  }

  // Conversation key (wa_contact). Prefer the real phone if Evolution provided one,
  // otherwise fall back to the raw @lid JID (stable per contact) or E.164 for classic JIDs.
  // @lid digits are an internal WhatsApp id, NOT a phone number — never show them as one.
  const contact = senderPnJid
    ? chatIdToPhone(senderPnJid)
    : remoteJid.endsWith("@lid")
    ? remoteJid
    : chatIdToPhone(remoteJid);
  const pushName: string = data?.pushName ?? "";
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

  // Route to the clinic that owns this Evolution instance.
  // Use JS-side filter because PostgREST JSONB text-extraction (.eq on "settings->>key"))
  // is unreliable across Supabase client versions.
  const { data: allClinics } = await supabase
    .from("clinics")
    .select("id, settings")
    .not("settings->evolution_instance", "is", null);

  const clinic = allClinics?.find(
    (c) => (c.settings as Record<string, string>)?.evolution_instance === instanceName
  ) ?? null;

  console.log("[evolution] clinic lookup for instance:", instanceName, "found:", !!clinic, "total checked:", allClinics?.length ?? 0);
  if (!clinic) return Response.json({ ok: true });

  const creds: EvolutionCreds = {
    host: clinic.settings?.evolution_host ?? "",
    apiKey: clinic.settings?.evolution_api_key ?? "",
    instance: instanceName,
  };
  if (!creds.host || !creds.apiKey) {
    console.log("[evolution] missing creds — host:", !!creds.host, "apiKey:", !!creds.apiKey);
    return Response.json({ ok: true });
  }

  console.log("[evolution] contact:", contact, "clinicId:", clinic.id);
  let patient = await findPatientByPhone(supabase, clinic.id, contact);
  console.log("[evolution] patient found by phone:", !!patient);
  // Unknown senders still get a conversation so the clinic can see who messaged them;
  // we just skip AI processing for them.

  const displayName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : (pushName || null);
  const conversationId = await getOrCreateConversation(supabase, clinic.id, patient?.id ?? null, contact, displayName ?? undefined);
  if (!conversationId) return Response.json({ ok: true });

  // For @lid contacts the phone lookup fails, but staff may have linked a patient
  // to this conversation via the "add as patient" flow. Resolve that patient and,
  // crucially, their real phone — the @lid JID itself is not routable for sending.
  let patientPhone: string | null = null;
  {
    const { data: conv } = await supabase
      .from("conversations")
      .select("patient_id")
      .eq("id", conversationId)
      .single();
    const linkedId = patient?.id ?? conv?.patient_id ?? null;
    if (linkedId) {
      const { data: p } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone")
        .eq("id", linkedId)
        .single();
      if (p) {
        patient = { id: p.id, first_name: p.first_name, last_name: p.last_name };
        patientPhone = p.phone ?? null;
      }
    }
  }

  // Where replies are actually sent. A real phone (patient's, or the senderPn the
  // webhook resolved) is always preferred; the raw @lid is a last-resort best effort.
  const sendTarget = patientPhone
    ? toChatId(normalizePhone(patientPhone))
    : senderPnJid
    ? toChatId(chatIdToPhone(senderPnJid))
    : remoteJid.endsWith("@lid")
    ? remoteJid
    : toChatId(chatIdToPhone(remoteJid));
  console.log("[evolution] sendTarget:", sendTarget, "patientPhone:", patientPhone);

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
        // Evolution sent base64 in the webhook body (webhookBase64: true)
        const clean = base64Media.replace(/^data:[^;]+;base64,/, "");
        const bin = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
        mediaBuffer = bin.buffer;
      } else {
        // No S3 and no base64 in webhook — fetch via Evolution API
        const dl = await getMediaBase64(creds, key as Record<string, unknown>, message);
        if (dl) {
          const clean = dl.base64.replace(/^data:[^;]+;base64,/, "");
          const bin = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
          mediaBuffer = bin.buffer;
          resolvedMime = dl.mimeType;
        }
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

  // Dedup via wa_message_id unique constraint. Body is encrypted at rest.
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    body: encryptMessage(body),
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
  if (patient && ["stop", "עצור", "הסר", "בטל רישום"].some((k) => lower.includes(k))) {
    await supabase.from("patient_consents").upsert({
      patient_id: patient.id,
      channel: "whatsapp",
      opted_in: false,
      source: "reply_stop",
      consented_at: new Date().toISOString(),
    });
    await sendText(creds, sendTarget, "הוסרת מרשימת ההתראות. שלחו START בכל עת לחידוש.");
    return Response.json({ ok: true });
  }

  // Process conversation with the AI agent.
  // For known patients the bot replies fully; for unknown senders the bot sends
  // a generic greeting and leaves the conversation in "bot" status so the clinic
  // can take it over manually when ready.
  const gotLock = await acquireLock(supabase, conversationId);
  if (gotLock) {
    try {
      if (patient) {
        await processConversation(
          supabase,
          { conversationId, contact: sendTarget, clinicId: clinic.id, patient: patient as PatientLite },
          (to, t) => sendText(creds, to, t)
        );
      } else {
        // Unknown sender — only send the name-collection greeting ONCE
        // (check no outbound messages exist yet)
        const { count: outboundCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .eq("direction", "outbound");

        if ((outboundCount ?? 0) === 0) {
          const greeting =
            "שלום! 👋 אני העוזר האוטומטי של הקליניקה.\n" +
            "כדי שנוכל לפתוח לך תיק ולסייע — מה שמך המלא?";
          const waId = await sendText(creds, sendTarget, greeting);
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            direction: "outbound",
            body: encryptMessage(greeting),
            wa_message_id: waId || null,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        }
        // Mark conversation as needing human attention — unknown sender,
        // staff need to identify and register them.
        await supabase.from("conversations").update({ status: "human" }).eq("id", conversationId);
      }
    } catch (e) {
      console.error("[evolution] processing error:", e);
    } finally {
      await releaseLock(supabase, conversationId);
    }
  }

  return Response.json({ ok: true });
}
