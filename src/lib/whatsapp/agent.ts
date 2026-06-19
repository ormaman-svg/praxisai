// Channel-agnostic WhatsApp patient-agent core.
// Both the Meta Cloud API webhook and the Green API (unofficial) webhook
// reuse this: they only differ in how messages are parsed and sent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoke } from "@/lib/ai/invoke";
import type { Message } from "@/lib/ai/invoke";
import { PATIENT_AGENT_TOOLS } from "@/lib/ai/tools/definitions";
import { runToolCall } from "@/lib/ai/tools/handlers";
import { encryptMessage, decryptMessage } from "@/lib/crypto/messages";

export type PatientLite = { id: string; first_name: string; last_name: string } | null;

export type ConvCtx = {
  conversationId: string;
  contact: string;       // send target (E.164 chat id or @lid) — where replies go
  contactPhone?: string | null; // real E.164 phone if known (for creating a lead)
  clinicId: string;
  patient: PatientLite;
};

// Sends a text and returns the provider message id (or "" if unknown).
export type SendFn = (to: string, text: string) => Promise<string>;

export const MAX_AGENT_TURNS = 5;     // tool-use turns within one reply
export const MAX_RECHECK_LOOPS = 3;   // re-process if new messages arrived during processing
export const LOCK_TTL_MS = 30_000;

export const PATIENT_AGENT_SYSTEM = `אתה עוזר אוטומטי של קליניקה פרא-רפואית, המתקשר עם מטופלים ופונים חדשים דרך WhatsApp.
התפקיד שלך הוא לתת שירות אמיתי ולסיים משימות — לא להפנות את הפונה "להתקשר לקליניקה" אלא אם אין ברירה.

כללים חשובים:
- אתה עונה בעברית תמיד (אלא אם הפונה כותב בערבית — אז בערבית).
- אסור לך לתת ייעוץ רפואי, אבחנות, או המלצות טיפול. אם נשאלת שאלה קלינית — הסלם לאדם.
- הודעות קצרות, חמות ויעילות. בדרך כלל עד 3-4 משפטים.

קביעת תורים (גם לפונים שאינם רשומים!):
- כשפונה רוצה לקבוע תור — נהל את התהליך עד הסוף, אל תפנה אותו לטלפון.
- שלב 1: אם אינך יודע את שמו המלא — בקש שם פרטי ושם משפחה.
- שלב 2: בקש בקצרה את סיבת הפנייה (תלונה עיקרית) וברר את רמת הדחיפות.
- שלב 3: קרא ל-list_available_slots (עם urgency מתאים: urgent / this_week / flexible) כדי לקבל זמנים פנויים אמיתיים מהיומן.
- שלב 4: הצע למטופל 2-3 אפשרויות מתוך הזמנים שהוחזרו, בשפה טבעית. אם דחוף — הצע קודם את הקרוב ביותר.
- שלב 5: אחרי שהמטופל בחר זמן, קרא ל-book_appointment עם starts_at ו-therapist_id בדיוק כפי שהוחזרו, וכן first_name+last_name אם הוא אינו רשום.
- שלב 6: אשר למטופל שהתור נקבע, ציין את היום והשעה, וציין שתישלח תזכורת.
- לעולם אל תמציא זמנים פנויים — השתמש רק במה ש-list_available_slots החזיר.

- אתה יכול גם: לאשר/לבטל/לדחות תורים קיימים, לשלוח קישור תשלום, לרשום ביצוע תרגילי בית, לאסוף ציוני תוצאה.
- אם אינך בטוח, או שיש בעיה שאינך יכול לפתור — הסלם לאדם (escalate_to_human).`;

// Race-safe: relies on the partial unique index (clinic_id, wa_contact) where status<>'closed'.
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string | null,
  contact: string,
  displayName?: string
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
      display_name: displayName ?? null,
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
        content: decryptMessage(m.body) ?? "",
      }));

    // Nothing to answer (already replied, or empty) → done
    if (!history.length || history[history.length - 1].role !== "user") return;

    const replyText = await runAgent(supabase, ctx, history);

    const waId = await send(ctx.contact, replyText);
    await supabase.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "outbound",
      body: encryptMessage(replyText),
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
      toolResults.push(await runToolCall(tc, supabase, {
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        patientId: ctx.patient?.id ?? null,
        contactPhone: ctx.contactPhone ?? null,
      }));
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
  // Common context for every conversation: current time (so the model reasons
  // about "today"/"this week") plus identifiers tools rely on.
  const nowHe = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem", weekday: "long", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date());

  let ctxText = `\n\nהקשר נוכחי:\nהתאריך והשעה כעת (שעון ישראל): ${nowHe}\n`;
  ctxText += `conversation_id: ${ctx.conversationId}, clinic_id: ${ctx.clinicId}\n`;

  if (!ctx.patient) {
    ctxText +=
      "הפונה אינו מטופל רשום עדיין. אם הוא מעוניין בתור — אסוף שם מלא וסיבת פנייה, " +
      "ואז קבע לו תור (book_appointment ייצור עבורו רשומת מטופל אוטומטית).";
    return PATIENT_AGENT_SYSTEM + ctxText;
  }

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

  ctxText += `\nמידע על המטופל:\nשם: ${ctx.patient.first_name} ${ctx.patient.last_name}\n`;
  ctxText += nextAppt
    ? `פגישה הבאה: ${new Date(nextAppt.starts_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} (appointment_id: ${nextAppt.id})\n`
    : "אין פגישות קרובות.\n";
  if (program) ctxText += `תוכנית תרגול פעילה: "${program.title}" (program_id: ${program.id})\n`;
  ctxText += `patient_id: ${ctx.patient.id}`;

  return PATIENT_AGENT_SYSTEM + ctxText;
}
