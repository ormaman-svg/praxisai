import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/whatsapp/verify";
import { findPatientByPhone } from "@/lib/whatsapp/normalize";
import { sendText } from "@/lib/whatsapp/client";
import { invoke } from "@/lib/ai/invoke";
import { PATIENT_AGENT_TOOLS } from "@/lib/ai/tools/definitions";
import { runToolCall } from "@/lib/ai/tools/handlers";
import type { Message } from "@/lib/ai/invoke";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_AGENT_TURNS = 5;     // tool-use turns within one reply
const MAX_RECHECK_LOOPS = 3;   // re-process if new messages arrived during processing
const LOCK_TTL_MS = 30_000;

const PATIENT_AGENT_SYSTEM = `אתה עוזר אוטומטי של קליניקה פרא-רפואית, המתקשר עם מטופלים דרך WhatsApp.
כללים חשובים:
- אתה עונה בעברית תמיד (אלא אם המטופל כותב בערבית — אז בערבית).
- אסור לך לתת ייעוץ רפואי, אבחנות, או המלצות טיפול. אם נשאלת — הסלם לאדם.
- אתה יכול: לאשר/לבטל/לדחות תורים, לשלוח קישור תשלום, לרשום ביצוע תרגילי בית, לאסוף ציוני תוצאה שבועיים.
- הודעות קצרות וידידותיות. לא יותר מ-3 משפטים.
- אם אינך בטוח — הסלם לאדם (escalate_to_human).`;

type ClinicCreds = { clinicId: string; phoneId: string; apiKey: string };
type PatientLite = { id: string; first_name: string; last_name: string } | null;
type ConvCtx = {
  conversationId: string;
  contact: string;
  creds: ClinicCreds;
  patient: PatientLite;
};

// GET — webhook verification challenge
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verify = url.searchParams.get("hub.verify_token");
  if (verify !== process.env.WA_VERIFY_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge ?? "ok", { status: 200 });
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
  const inbound = value?.messages as
    | { id: string; from: string; text?: { body: string }; type: string }[]
    | undefined;

  if (!inbound?.length) {
    // Status callbacks (delivered/read) — ack silently
    return Response.json({ ok: true });
  }

  const supabase = createAdminClient();

  // ── Phase A: persist every inbound message, collect affected conversations ──
  const affected = new Map<string, ConvCtx>();

  for (const msg of inbound) {
    if (msg.type !== "text" || !msg.text?.body) continue;

    const ctx = await resolveContext(supabase, msg.from);
    if (!ctx) continue; // unknown sender / clinic without WA credentials

    // Dedup via unique wa_message_id — Meta retries won't double-insert
    await supabase.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "inbound",
      body: msg.text.body.trim(),
      wa_message_id: msg.id,
      status: "delivered",
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", ctx.conversationId);

    // Opt-out keywords short-circuit the bot
    const lower = msg.text.body.toLowerCase();
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
      continue; // do not enqueue for bot processing
    }

    affected.set(ctx.conversationId, ctx);
  }

  // ── Phase B: process each conversation once, serialized by a lease lock ──
  for (const ctx of Array.from(affected.values())) {
    const gotLock = await acquireLock(supabase, ctx.conversationId);
    if (!gotLock) continue; // another invocation holds it and will pick up our message

    try {
      await processConversation(supabase, ctx);
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
  fromPhone: string
): Promise<ConvCtx | null> {
  const { data: clinics } = await supabase
    .from("clinics")
    .select("id, settings")
    .not("settings->wa_phone_id", "is", null)
    .limit(50);

  for (const clinic of clinics ?? []) {
    const patient = await findPatientByPhone(supabase, clinic.id, fromPhone);
    if (!patient) continue;

    const phoneId = clinic.settings?.wa_phone_id;
    const apiKey = clinic.settings?.wa_api_key;
    if (!phoneId || !apiKey) return null;

    const creds: ClinicCreds = { clinicId: clinic.id, phoneId, apiKey };
    const conversationId = await getOrCreateConversation(supabase, clinic.id, patient.id, fromPhone);
    if (!conversationId) return null;

    return { conversationId, contact: fromPhone, creds, patient };
  }
  return null;
}

// Race-safe: relies on the partial unique index (clinic_id, wa_contact) where status<>'closed'.
async function getOrCreateConversation(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  contact: string
): Promise<string | null> {
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("wa_contact", contact)
    .neq("status", "closed")
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const insert = await supabase
    .from("conversations")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      channel: "whatsapp",
      wa_contact: contact,
      status: "bot",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insert.data?.id) return insert.data.id;

  // Lost the insert race (unique index) — re-select the row the winner created
  const retry = await supabase
    .from("conversations")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("wa_contact", contact)
    .neq("status", "closed")
    .limit(1)
    .maybeSingle();
  return retry.data?.id ?? null;
}

// Atomic compare-and-set lease lock via UPDATE ... WHERE (free) RETURNING.
async function acquireLock(supabase: SupabaseClient, convId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString();
  const { data } = await supabase
    .from("conversations")
    .update({ locked_until: until })
    .eq("id", convId)
    .or(`locked_until.is.null,locked_until.lt.${now}`)
    .select("id");
  return !!(data && data.length);
}

async function releaseLock(supabase: SupabaseClient, convId: string) {
  await supabase.from("conversations").update({ locked_until: null }).eq("id", convId);
}

async function processConversation(supabase: SupabaseClient, ctx: ConvCtx) {
  for (let loop = 0; loop < MAX_RECHECK_LOOPS; loop++) {
    // Skip if a human took over mid-flight
    const { data: conv } = await supabase
      .from("conversations")
      .select("status")
      .eq("id", ctx.conversationId)
      .single();
    if (conv?.status === "human") return;

    const { data: recent } = await supabase
      .from("messages")
      .select("direction, body, created_at")
      .eq("conversation_id", ctx.conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history: Message[] = (recent ?? [])
      .reverse()
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body ?? "",
      }));

    // Nothing to answer (already replied, or empty) → done
    if (!history.length || history[history.length - 1].role !== "user") return;

    const replyText = await runAgent(supabase, ctx, history);

    const waId = await sendText(ctx.creds, ctx.contact, replyText);
    await supabase.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "outbound",
      body: replyText,
      wa_message_id: waId || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    // Loop re-checks: if a new inbound arrived during the agent call, answer it too.
  }
}

async function runAgent(
  supabase: SupabaseClient,
  ctx: ConvCtx,
  history: Message[]
): Promise<string> {
  const system = await buildSystem(supabase, ctx);
  let messages: Message[] = [...history];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const result = await invoke({
      system,
      messages,
      tools: PATIENT_AGENT_TOOLS,
      maxTokens: 512,
    });

    if (!result.toolCalls.length) {
      return result.text || "תודה על ההודעה. נציג יחזור אליכם בהקדם.";
    }

    const toolResults: string[] = [];
    for (const tc of result.toolCalls) {
      toolResults.push(await runToolCall(tc, supabase));
    }

    messages = [
      ...messages,
      { role: "assistant", content: `${result.text}\n[כלים: ${result.toolCalls.map((t) => t.name).join(", ")}]` },
      { role: "user", content: toolResults.join("\n") },
    ];
  }

  return "תודה על ההודעה. נציג יחזור אליכם בהקדם.";
}

async function buildSystem(supabase: SupabaseClient, ctx: ConvCtx): Promise<string> {
  if (!ctx.patient) return PATIENT_AGENT_SYSTEM;

  const [{ data: nextAppt }, { data: program }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at")
      .eq("patient_id", ctx.patient.id)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("exercise_programs")
      .select("id, title")
      .eq("patient_id", ctx.patient.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  let ctxText = `\n\nמידע על המטופל:\nשם: ${ctx.patient.first_name} ${ctx.patient.last_name}\n`;
  ctxText += nextAppt
    ? `פגישה הבאה: ${new Date(nextAppt.starts_at).toLocaleString("he-IL")} (appointment_id: ${nextAppt.id})\n`
    : "אין פגישות קרובות.\n";
  if (program) ctxText += `תוכנית תרגול פעילה: "${program.title}" (program_id: ${program.id})\n`;
  ctxText += `patient_id: ${ctx.patient.id}, clinic_id: ${ctx.creds.clinicId}, conversation_id: ${ctx.conversationId}`;

  return PATIENT_AGENT_SYSTEM + ctxText;
}
