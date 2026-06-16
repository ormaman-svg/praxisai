// Tool handler implementations for the patient-facing WhatsApp agent.
// Each handler receives the tool input and a Supabase admin client, writes to DB,
// and returns a human-readable Hebrew result string for the agent to relay.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolCall } from "../invoke";
import { notifyEscalation } from "@/lib/notifications/escalation";

type ToolHandler = (input: Record<string, unknown>, supabase: SupabaseClient) => Promise<string>;

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  async confirm_appointment(input, supabase) {
    const { error } = await supabase
      .from("appointments")
      .update({ notes: "מאושר על ידי מטופל ב-WhatsApp" })
      .eq("id", input.appointment_id as string);
    if (error) return "שגיאה באישור הפגישה.";
    return "הפגישה אושרה בהצלחה.";
  },

  async cancel_appointment(input, supabase) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled", notes: `ביטול על ידי מטופל: ${input.reason ?? ""}` })
      .eq("id", input.appointment_id as string);
    if (error) return "שגיאה בביטול הפגישה.";
    return "הפגישה בוטלה.";
  },

  async reschedule_request(input, supabase) {
    const { error } = await supabase
      .from("appointments")
      .update({ notes: `בקשת דחייה מהמטופל: ${input.preferred_time ?? "ללא העדפה"}` })
      .eq("id", input.appointment_id as string);
    if (error) return "שגיאה ברישום בקשת הדחייה.";
    return "בקשת הדחייה נרשמה — צוות הקליניקה ייצור קשר לתיאום.";
  },

  async check_balance(input, supabase) {
    const { data, error } = await supabase
      .from("patient_invoices")
      .select("id, amount_ils, description")
      .eq("patient_id", input.patient_id as string)
      .eq("status", "pending");
    if (error) return "שגיאה בבדיקת היתרה.";
    if (!data?.length) return "אין יתרה פתוחה לתשלום.";
    const total = data.reduce((s, i) => s + Number(i.amount_ils), 0);
    return `יתרת חוב: ${total} ₪ (${data.length} חשבוניות פתוחות).`;
  },

  async send_payment_link(input, supabase) {
    const { data: inv } = await supabase
      .from("patient_invoices")
      .select("stripe_payment_link, amount_ils")
      .eq("id", input.invoice_id as string)
      .single();
    if (!inv?.stripe_payment_link) return "קישור תשלום לא זמין — פנו לקליניקה.";
    return `לתשלום ${inv.amount_ils} ₪: ${inv.stripe_payment_link}`;
  },

  async log_hep_completion(input, supabase) {
    const { error } = await supabase.from("hep_logs").insert({
      program_id: input.program_id,
      patient_id: input.patient_id,
      completed: input.completed ?? true,
      pain_score: input.pain_score ?? null,
      notes: input.notes ?? null,
      logged_via: "whatsapp",
    });
    if (error) return "שגיאה ברישום התרגילים.";
    const score = input.pain_score != null ? ` (רמת כאב: ${input.pain_score}/10)` : "";
    return input.completed
      ? `תרגילי הבית נרשמו — כל הכבוד!${score}`
      : `נרשם שהתרגילים לא בוצעו${score}. מה עצר אתכם?`;
  },

  async collect_prom(input, supabase) {
    const { error } = await supabase.from("measurements").insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      kind: "PROM",
      joint: null,
      movement: input.scale_label ?? "שאלון תוצאה",
      value: input.score,
      unit: "score",
      recorded_at: new Date().toISOString(),
    });
    if (error) return "שגיאה בשמירת הציון.";
    return `הציון ${input.score}/10 נשמר. תודה על הדיווח!`;
  },

  async escalate_to_human(input, supabase) {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "human" })
      .eq("id", input.conversation_id as string);
    if (error) return "שגיאה בהעברה לנציג.";

    // Notify clinic staff asynchronously (best-effort)
    const { data: conv } = await supabase
      .from("conversations")
      .select("clinic_id, patients(first_name, last_name), wa_contact")
      .eq("id", input.conversation_id as string)
      .single();
    if (conv) {
      const patient = (Array.isArray(conv.patients) ? conv.patients[0] : conv.patients) as { first_name: string; last_name: string } | null;
      const patientName = patient
        ? `${patient.first_name} ${patient.last_name}`
        : (conv.wa_contact ?? "מטופל");
      notifyEscalation({ clinicId: conv.clinic_id, patientName, reason: "bot" });
    }

    return "העברתי אתכם לנציג אנושי — יחזרו אליכם בהקדם.";
  },
};

export async function runToolCall(
  toolCall: ToolCall,
  supabase: SupabaseClient
): Promise<string> {
  const handler = TOOL_HANDLERS[toolCall.name];
  if (!handler) return `כלי לא מוכר: ${toolCall.name}`;
  try {
    return await handler(toolCall.input, supabase);
  } catch (e) {
    return `שגיאה בביצוע ${toolCall.name}: ${String(e)}`;
  }
}
