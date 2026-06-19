import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/whatsapp/verify";
import { findPatientByPhone } from "@/lib/whatsapp/normalize";
import { sendText, downloadMedia } from "@/lib/whatsapp/client";
import { notifyEscalation } from "@/lib/notifications/escalation";
import {
  getOrCreateConversation,
  acquireLock,
  releaseLock,
  processConversation,
  type PatientLite,
} from "@/lib/whatsapp/agent";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MEDIA_TYPES = ["image", "video", "audio", "document"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/opus": "ogg", "audio/aac": "aac",
};

type ClinicCreds = { clinicId: string; phoneNumberId: string; accessToken: string };
type ConvCtx = {
  conversationId: string;
  contact: string;
  creds: ClinicCreds;
  patient: PatientLite;
};

// GET — Meta webhook verification handshake (hub.mode / hub.verify_token / hub.challenge)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verify = url.searchParams.get("hub.verify_token");
  if (mode === "subscribe" && verify === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const sig = request.headers.get("X-Hub-Signature-256") ?? "";
  const appSecret = process.env.WA_APP_SECRET ?? "";
  if (appSecret && !verifySignature(rawBody, sig, appSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const entry = (payload.entry as { changes: { value: Record<string, unknown> }[] }[])?.[0];
  const value = entry?.changes?.[0]?.value;
  const metadata = value?.metadata as { phone_number_id?: string } | undefined;
  const phoneNumberId = metadata?.phone_number_id;
  type WaMessage = {
    id: string;
    from: string;
    type: string;
    text?: { body: string };
    image?: { id: string; caption?: string; mime_type?: string };
    video?: { id: string; caption?: string; mime_type?: string };
    audio?: { id: string; mime_type?: string };
    document?: { id: string; caption?: string; mime_type?: string; filename?: string };
  };
  const inbound = value?.messages as WaMessage[] | undefined;

  if (!inbound?.length || !phoneNumberId) {
    // Status callbacks (delivered/read) or missing routing info — ack silently
    return Response.json({ ok: true });
  }

  const supabase = createAdminClient();

  // ── Phase A: persist every inbound message, collect affected conversations ──
  const affected = new Map<string, ConvCtx>();

  for (const msg of inbound) {
    const isText = msg.type === "text" && !!msg.text?.body;
    const isMedia = (MEDIA_TYPES as readonly string[]).includes(msg.type);
    if (!isText && !isMedia) continue;

    const ctx = await resolveContext(supabase, phoneNumberId, msg.from);
    if (!ctx) continue;

    let body: string | null = null;
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (isText) {
      body = msg.text!.body.trim();
    } else {
      // Download media from Meta and store in Supabase Storage
      const mediaObj = msg[msg.type as MediaType] as { id: string; caption?: string } | undefined;
      if (mediaObj?.id) {
        try {
          const { data, mimeType } = await downloadMedia(mediaObj.id, ctx.creds.accessToken);
          const ext = MIME_EXT[mimeType] ?? "bin";
          const storagePath = `${ctx.creds.clinicId}/${msg.id}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("whatsapp-media")
            .upload(storagePath, data, { contentType: mimeType, upsert: false });
          if (!uploadErr) {
            mediaUrl = storagePath;
            mediaType = msg.type;
          }
          body = mediaObj.caption ?? null;
        } catch (e) {
          console.error("[webhook] media download failed:", e);
          body = `[${msg.type}]`;
        }
      }
    }

    // Dedup via unique wa_message_id — Meta retries won't double-insert
    await supabase.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "inbound",
      body,
      media_url: mediaUrl,
      media_type: mediaType,
      wa_message_id: msg.id,
      status: "delivered",
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", ctx.conversationId);

    if (!body) {
      // Media-only message — persist and escalate to human; notify clinic staff
      await supabase.from("conversations").update({ status: "human" }).eq("id", ctx.conversationId);
      const patientName = ctx.patient
        ? `${ctx.patient.first_name} ${ctx.patient.last_name}`
        : ctx.contact;
      notifyEscalation({ clinicId: ctx.creds.clinicId, patientName, reason: "media" });
      affected.delete(ctx.conversationId);
      continue;
    }

    // Opt-out keywords short-circuit the bot
    const lower = body.toLowerCase();
    if (["stop", "עצור", "הסר", "בטל רישום"].some((k) => lower.includes(k))) {
      if (ctx.patient) {
        await supabase.from("patient_consents").upsert({
          patient_id: ctx.patient.id,
          channel: "whatsapp",
          opted_in: false,
          source: "reply_stop",
          consented_at: new Date().toISOString(),
        });
      }
      await sendText(ctx.creds, ctx.contact, "הוסרת מרשימת ההתראות. שלחו START בכל עת לחידוש.");
      continue;
    }

    affected.set(ctx.conversationId, ctx);
  }

  // ── Phase B: process each conversation once, serialized by a lease lock ──
  for (const ctx of Array.from(affected.values())) {
    const gotLock = await acquireLock(supabase, ctx.conversationId);
    if (!gotLock) continue; // another invocation holds it and will pick up our message

    try {
      await processConversation(
        supabase,
        { conversationId: ctx.conversationId, contact: ctx.contact, contactPhone: ctx.contact, clinicId: ctx.creds.clinicId, patient: ctx.patient },
        (to, text) => sendText(ctx.creds, to, text)
      );
    } catch (e) {
      console.error("[whatsapp] processing error:", e);
    } finally {
      await releaseLock(supabase, ctx.conversationId);
    }
  }

  return Response.json({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveContext(
  supabase: SupabaseClient,
  phoneNumberId: string,
  fromPhone: string
): Promise<ConvCtx | null> {
  // Meta tells us exactly which business number received the message,
  // so we route directly to the owning clinic by its phone_number_id.
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, settings")
    .eq("settings->>wa_phone_number_id", phoneNumberId)
    .limit(1)
    .maybeSingle();
  if (!clinic) return null;

  const accessToken = clinic.settings?.wa_access_token;
  if (!accessToken) return null;

  const patient = await findPatientByPhone(supabase, clinic.id, fromPhone);
  if (!patient) return null; // do not engage unknown senders

  const creds: ClinicCreds = { clinicId: clinic.id, phoneNumberId, accessToken };
  const conversationId = await getOrCreateConversation(supabase, clinic.id, patient.id, fromPhone);
  if (!conversationId) return null;

  return { conversationId, contact: fromPhone, creds, patient };
}
