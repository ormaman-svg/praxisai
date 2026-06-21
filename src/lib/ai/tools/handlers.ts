// Tool handler implementations for the patient-facing WhatsApp agent.
// Each handler receives the tool input and a Supabase admin client, writes to DB,
// and returns a human-readable Hebrew result string for the agent to relay.

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolCall } from "../invoke";
import { notifyEscalation } from "@/lib/notifications/escalation";
import { sendSms, smsEnabled } from "@/lib/sms/send";
import {
  getBookingConfig,
  computeAvailableSlots,
  formatSlotHebrew,
  type Therapist,
} from "@/lib/whatsapp/availability";

// ── Identity verification (for patient self-service of personal data) ──────────
// A successful verification (national ID OR SMS code) is valid for this long.
const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const OTP_TTL_MS = 10 * 60 * 1000;            // one-time code lifetime
const OTP_MAX_ATTEMPTS = 5;

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const hashOtp = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

// True when this conversation has a non-expired verification on record.
async function isVerified(supabase: SupabaseClient, conversationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("conversations")
    .select("verified_at")
    .eq("id", conversationId)
    .single();
  if (!data?.verified_at) return false;
  return Date.now() - new Date(data.verified_at).getTime() < VERIFY_WINDOW_MS;
}

// Instruction returned to the model when verification is required but missing.
function needsVerification(): string {
  const sms = smsEnabled() ? " או לשליחת קוד אימות ב-SMS לנייד הרשום" : "";
  return (
    "המטופל אינו מאומת. אל תמסור מידע אישי. " +
    `הצע למטופל לאמת את זהותו באחת מהדרכים (לא שתיהן): מסירת מספר תעודת זהות${sms}. ` +
    "לאחר שיבחר — קרא לכלי האימות המתאים."
  );
}

// Context the agent passes alongside each tool call so handlers can act on the
// current conversation/clinic without the model having to echo IDs back.
export type ToolCtx = {
  clinicId: string;
  conversationId: string;
  patientId: string | null;
  contactPhone: string | null; // real E.164 phone if known (null for @lid)
};

type ToolHandler = (
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  ctx: ToolCtx
) => Promise<string>;

async function loadTherapists(supabase: SupabaseClient, clinicId: string): Promise<Therapist[]> {
  const { data } = await supabase
    .from("clinic_members")
    .select("user_id, role, profiles(full_name)")
    .eq("clinic_id", clinicId)
    .eq("status", "active");
  return (data ?? [])
    .filter((m) => ["owner", "admin", "therapist"].includes(m.role as string))
    .map((m) => ({
      id: m.user_id as string,
      name: (m.profiles as unknown as { full_name: string } | null)?.full_name ?? "המטפל/ת",
    }));
}

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  async list_available_slots(input, supabase, ctx) {
    const { data: clinic } = await supabase
      .from("clinics").select("settings").eq("id", ctx.clinicId).single();
    const config = getBookingConfig(clinic?.settings as Record<string, unknown> | null);
    const therapists = await loadTherapists(supabase, ctx.clinicId);

    const urgency = (input.urgency as string) ?? "flexible";
    const lookaheadDays = urgency === "urgent" ? 7 : urgency === "this_week" ? 7 : 21;
    const slots = await computeAvailableSlots(supabase, ctx.clinicId, therapists, config, {
      lookaheadDays,
      limit: urgency === "urgent" ? 3 : 5,
    });

    if (!slots.length)
      return "אין כרגע תורים פנויים בטווח הקרוב. הצע למטופל שניצור איתו קשר לתיאום, או קרא ל-escalate_to_human.";

    // The machine fields (starts_at/therapist_id) must be passed verbatim to book_appointment.
    const lines = slots.map((s, i) => {
      const who = s.therapistName ? ` (${s.therapistName})` : "";
      const tid = s.therapistId ? ` therapist_id=${s.therapistId}` : "";
      return `${i + 1}. ${formatSlotHebrew(s.startsAt)}${who} — starts_at=${s.startsAt.toISOString()}${tid}`;
    });
    return (
      "תורים פנויים (הצג למטופל בשפה טבעית, ובעת קביעה העבר starts_at ו-therapist_id בדיוק כפי שמופיע כאן):\n" +
      lines.join("\n")
    );
  },

  async book_appointment(input, supabase, ctx) {
    const startsAtStr = input.starts_at as string;
    if (!startsAtStr) return "חסר זמן התחלה (starts_at).";
    const start = new Date(startsAtStr);
    if (isNaN(start.getTime())) return "זמן התחלה לא תקין.";

    const { data: clinic } = await supabase
      .from("clinics").select("settings").eq("id", ctx.clinicId).single();
    const config = getBookingConfig(clinic?.settings as Record<string, unknown> | null);
    const duration = (input.duration_minutes as number) || config.slotMinutes;
    const end = new Date(start.getTime() + duration * 60_000);

    // Resolve / create the patient (lead) record.
    let patientId = ctx.patientId;
    let createdLead = false;
    if (!patientId) {
      const first = (input.first_name as string)?.trim();
      const last = (input.last_name as string)?.trim();
      if (!first || !last)
        return "כדי לקבוע תור לפונה שאינו רשום צריך שם פרטי ושם משפחה — בקש אותם מהמטופל.";
      const nationalId = onlyDigits(input.national_id as string);
      const { data: lead, error: leadErr } = await supabase
        .from("patients")
        .insert({
          clinic_id: ctx.clinicId,
          first_name: first,
          last_name: last,
          phone: ctx.contactPhone,
          national_id: nationalId || null,
          referral_source: "WhatsApp",
        })
        .select("id, first_name")
        .single();
      if (leadErr || !lead) return "יצירת רשומת המטופל נכשלה. קרא ל-escalate_to_human.";
      patientId = lead.id;
      createdLead = true;
      // Link the new patient to this conversation for the clinic staff.
      await supabase
        .from("conversations")
        .update({ patient_id: patientId, display_name: `${first} ${last}` })
        .eq("id", ctx.conversationId);
    }

    const therapistId = (input.therapist_id as string) || null;

    // Re-check the slot is still free (race against staff/other bookings).
    const { data: clash } = await supabase
      .from("appointments")
      .select("id, therapist_id")
      .eq("clinic_id", ctx.clinicId)
      .eq("status", "scheduled")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString());
    const taken = (clash ?? []).some(
      (a) => a.therapist_id === null || therapistId === null || a.therapist_id === therapistId
    );
    if (taken)
      return "התור הזה כבר נתפס בינתיים. קרא שוב ל-list_available_slots והצע זמן אחר.";

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: ctx.clinicId,
        patient_id: patientId,
        therapist_id: therapistId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "scheduled",
        notes: input.reason ? `נקבע ב-WhatsApp. סיבה: ${input.reason}` : "נקבע ב-WhatsApp על ידי העוזר האוטומטי",
      })
      .select("id")
      .single();
    if (error || !appt) return "קביעת התור נכשלה. קרא ל-escalate_to_human.";

    // Best-effort reminders (24h + 2h before).
    const { data: pat } = await supabase
      .from("patients").select("first_name").eq("id", patientId).single();
    const timeStr = formatSlotHebrew(start);
    const rem24h = new Date(start.getTime() - 24 * 60 * 60_000).toISOString();
    const rem2h = new Date(start.getTime() - 2 * 60 * 60_000).toISOString();
    if (start.getTime() - Date.now() > 24 * 60 * 60_000) {
      await supabase.from("scheduled_messages").insert({
        clinic_id: ctx.clinicId, patient_id: patientId, appointment_id: appt.id,
        template_key: "reminder_24h", template_vars: [pat?.first_name ?? "", timeStr], scheduled_for: rem24h,
      }).then(() => {}, () => {});
    }
    if (start.getTime() - Date.now() > 2 * 60 * 60_000) {
      await supabase.from("scheduled_messages").insert({
        clinic_id: ctx.clinicId, patient_id: patientId, appointment_id: appt.id,
        template_key: "reminder_2h", template_vars: [pat?.first_name ?? "", timeStr], scheduled_for: rem2h,
      }).then(() => {}, () => {});
    }

    const leadNote = createdLead ? " נפתח עבורך תיק בקליניקה." : "";
    return `התור נקבע בהצלחה ל-${timeStr}.${leadNote} אשר למטופל את הזמן ואמור לו שתישלח תזכורת לפני התור.`;
  },

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

  async check_balance(input, supabase, ctx) {
    // Financial info is personal — require verification first.
    if (!(await isVerified(supabase, ctx.conversationId))) return needsVerification();
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

  // ── Identity verification + personal-data access ─────────────────────────────

  async verify_identity_id(input, supabase, ctx) {
    if (!ctx.patientId) return "המטופל אינו רשום במערכת — אין מידע אישי לאמת. הצע לקבוע תור.";
    const given = onlyDigits(input.national_id as string);
    if (given.length < 5) return "מספר תעודת הזהות שנמסר אינו תקין. בקש מהמטופל למסור שוב.";

    const { data: patient } = await supabase
      .from("patients")
      .select("national_id")
      .eq("id", ctx.patientId)
      .single();
    const onFile = onlyDigits(patient?.national_id ?? "");
    if (!onFile)
      return "אין תעודת זהות שמורה עבור מטופל זה. הצע אימות ב-SMS, או קרא ל-escalate_to_human כדי שנציג יוודא פרטים.";

    if (given !== onFile)
      return "תעודת הזהות אינה תואמת לרשום במערכת. בקש מהמטופל לוודא ולנסות שוב, או הצע אימות ב-SMS.";

    await supabase
      .from("conversations")
      .update({ verified_at: new Date().toISOString(), verification_method: "national_id", otp_hash: null, otp_expires_at: null, otp_attempts: 0 })
      .eq("id", ctx.conversationId);
    return "הזהות אומתה בהצלחה (תעודת זהות). כעת מותר למסור למטופל את המידע האישי שביקש.";
  },

  async send_verification_sms(_input, supabase, ctx) {
    if (!ctx.patientId) return "המטופל אינו רשום במערכת. הצע לקבוע תור.";
    if (!smsEnabled())
      return "אימות ב-SMS אינו זמין כרגע. הצע למטופל לאמת באמצעות מספר תעודת זהות.";

    const { data: patient } = await supabase
      .from("patients")
      .select("phone")
      .eq("id", ctx.patientId)
      .single();
    if (!patient?.phone)
      return "אין מספר נייד שמור עבור מטופל זה לשליחת קוד. הצע אימות בתעודת זהות, או קרא ל-escalate_to_human.";

    const code = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
    await supabase
      .from("conversations")
      .update({
        otp_hash: hashOtp(code),
        otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        otp_attempts: 0,
      })
      .eq("id", ctx.conversationId);

    const { sent } = await sendSms(patient.phone, `קוד האימות שלך לקליניקה: ${code} (תקף ל-10 דקות).`);
    if (!sent)
      return "שליחת ה-SMS נכשלה. הצע למטופל לאמת באמצעות מספר תעודת זהות.";
    return "נשלח קוד אימות בן 4 ספרות ל-SMS לנייד הרשום. בקש מהמטופל את הקוד וקרא ל-verify_sms_code.";
  },

  async verify_sms_code(input, supabase, ctx) {
    const code = onlyDigits(input.code as string);
    const { data: conv } = await supabase
      .from("conversations")
      .select("otp_hash, otp_expires_at, otp_attempts")
      .eq("id", ctx.conversationId)
      .single();
    if (!conv?.otp_hash || !conv.otp_expires_at)
      return "לא נשלח קוד אימות. קרא תחילה ל-send_verification_sms.";
    if (Date.now() > new Date(conv.otp_expires_at).getTime())
      return "הקוד פג תוקף. שלח קוד חדש עם send_verification_sms.";
    if ((conv.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS)
      return "יותר מדי ניסיונות שגויים. שלח קוד חדש עם send_verification_sms.";

    if (hashOtp(code) !== conv.otp_hash) {
      await supabase
        .from("conversations")
        .update({ otp_attempts: (conv.otp_attempts ?? 0) + 1 })
        .eq("id", ctx.conversationId);
      return "הקוד שגוי. בקש מהמטופל לנסות שוב.";
    }

    await supabase
      .from("conversations")
      .update({ verified_at: new Date().toISOString(), verification_method: "sms_otp", otp_hash: null, otp_expires_at: null, otp_attempts: 0 })
      .eq("id", ctx.conversationId);
    return "הזהות אומתה בהצלחה (קוד SMS). כעת מותר למסור למטופל את המידע האישי שביקש.";
  },

  async get_patient_history(_input, supabase, ctx) {
    if (!ctx.patientId) return "המטופל אינו רשום במערכת — אין היסטוריה. הצע לקבוע תור.";
    if (!(await isVerified(supabase, ctx.conversationId))) return needsVerification();

    const nowIso = new Date().toISOString();
    const [{ data: upcoming }, { data: past }, { data: treatments }, { data: program }] = await Promise.all([
      supabase
        .from("appointments")
        .select("starts_at, status")
        .eq("patient_id", ctx.patientId)
        .gte("starts_at", nowIso)
        .order("starts_at")
        .limit(3),
      supabase
        .from("appointments")
        .select("starts_at, status")
        .eq("patient_id", ctx.patientId)
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(5),
      supabase
        .from("treatments")
        .select("treated_at, type")
        .eq("patient_id", ctx.patientId)
        .order("treated_at", { ascending: false })
        .limit(5),
      supabase
        .from("exercise_programs")
        .select("title")
        .eq("patient_id", ctx.patientId)
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const fmt = (iso: string) => formatSlotHebrew(new Date(iso));
    const lines: string[] = [];

    if (upcoming?.length) {
      lines.push("פגישות קרובות:");
      upcoming.forEach((a) => lines.push(`• ${fmt(a.starts_at)}`));
    } else {
      lines.push("אין פגישות קרובות מתוזמנות.");
    }

    if (past?.length) {
      lines.push("פגישות אחרונות:");
      past.forEach((a) => lines.push(`• ${fmt(a.starts_at)}${a.status === "cancelled" ? " (בוטל)" : ""}`));
    }

    if (treatments?.length) {
      lines.push("טיפולים אחרונים:");
      treatments.forEach((t) => lines.push(`• ${fmt(t.treated_at)}`));
    }

    if (program?.title) lines.push(`תוכנית תרגול פעילה: "${program.title}".`);

    lines.push(
      "מסור למטופל סיכום בשפה טבעית. לשאלות קליניות מפורטות (תוכן רשומה רפואית) — הצע לתאם עם המטפל או קרא ל-escalate_to_human."
    );
    return lines.join("\n");
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
  supabase: SupabaseClient,
  ctx: ToolCtx
): Promise<string> {
  const handler = TOOL_HANDLERS[toolCall.name];
  if (!handler) return `כלי לא מוכר: ${toolCall.name}`;
  try {
    return await handler(toolCall.input, supabase, ctx);
  } catch (e) {
    return `שגיאה בביצוע ${toolCall.name}: ${String(e)}`;
  }
}
