// Channel-agnostic WhatsApp patient-agent core.
// Both the Meta Cloud API webhook and the Green API (unofficial) webhook
// reuse this: they only differ in how messages are parsed and sent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoke } from "@/lib/ai/invoke";
import type { Message } from "@/lib/ai/invoke";
import { PATIENT_AGENT_TOOLS } from "@/lib/ai/tools/definitions";
import { runToolCall } from "@/lib/ai/tools/handlers";

export type PatientLite = { id: string; first_name: string; last_name: string } | null;

export type ConvCtx = {
  conversationId: string;
  contact: string;       // E.164-ish phone of the remote party
  clinicId: string;
  patient: PatientLite;
};

// Sends a text and returns the provider message id (or "" if unknown).
export type SendFn = (to: string, text: string) => Promise<string>;

export const MAX_AGENT_TURNS = 5;     // tool-use turns within one reply
export const MAX_RECHECK_LOOPS = 3;   // re-process if new messages arrived during processing
export const LOCK_TTL_MS = 30_000;

export const PATIENT_AGENT_SYSTEM = `אתה עוזר אוטומטי של קליניקה פרא-רפואית, המתקשר עם מטופלים דרך WhatsApp.
כללים חשובים:
- אתה עונה בעברית תמיד (אלא אם המטופל כותב בערבית — אז בערבית).
- אסור לך לתת ייעוץ רפואי, אבחנות, או המלצות טיפול. אם נשאלת — הסלם לאדם.
- אתה יכול: לאשר/לבטל/לדחות תורים, לשלוח קישור תשלום, לרשום ביצוע תרגילי בית, לאסוף ציוני תוצאה שבועיים.
- הודעות קצרות וידידותיות. לא יותר מ-3 משפטים.
- אם אינך בטוח — הסלם לאדם (escalate_to_human).`;

// Race-safe: relies on the partial unique index (clinic_id, wa_contact) where status<>'closed'.
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string | null,
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
export async function acquireLock(supabase: SupabaseClient, convId: string): Promise<boolean> {
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

export async function releaseLock(supabase: SupabaseClient, convId: string) {
  await supabase.from("conversations").update({ locked_until: null }).eq("id", convId);
}

export async function processConversation(
  supabase: SupabaseClient,
  ctx: ConvCtx,
  send: SendFn
) {
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

    const waId = await send(ctx.contact, replyText);
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
  ctxText += `patient_id: ${ctx.patient.id}, clinic_id: ${ctx.clinicId}, conversation_id: ${ctx.conversationId}`;

  return PATIENT_AGENT_SYSTEM + ctxText;
}
