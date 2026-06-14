import type { ToolDefinition } from "../invoke";

export const PATIENT_AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "confirm_appointment",
    description: "מסמן פגישה כמאושרת על ידי המטופל (status=scheduled נשאר, מוסיף confirmation_at).",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "UUID של הפגישה לאישור" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "cancel_appointment",
    description: "מבטל פגישה — מעדכן status=cancelled.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        reason: { type: "string", description: "סיבת הביטול (אופציונלי)" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "reschedule_request",
    description: "מסמן בקשת דחייה — יוצר הודעה למתזמן בקליניקה לחזור למטופל.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string" },
        preferred_time: { type: "string", description: "תיאור חופשי של הזמן המבוקש" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "check_balance",
    description: "מחזיר את יתרת החוב הפתוחה של המטופל (חשבוניות במצב pending).",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string" },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "send_payment_link",
    description: "שולח למטופל קישור תשלום Stripe עבור חשבונית פתוחה.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
      },
      required: ["invoice_id"],
    },
  },
  {
    name: "log_hep_completion",
    description: "מתעד ביצוע תרגילי בית — שומר hep_log עם ציון כאב.",
    input_schema: {
      type: "object",
      properties: {
        program_id: { type: "string" },
        patient_id: { type: "string" },
        completed: { type: "boolean" },
        pain_score: { type: "number", minimum: 0, maximum: 10 },
        notes: { type: "string" },
      },
      required: ["program_id", "patient_id", "completed"],
    },
  },
  {
    name: "collect_prom",
    description: "שומר ציון תוצאה שבועי (PROM) כ-measurement עבור המטופל.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string" },
        clinic_id: { type: "string" },
        score: { type: "number", minimum: 0, maximum: 10 },
        scale_label: { type: "string" },
      },
      required: ["patient_id", "clinic_id", "score"],
    },
  },
  {
    name: "escalate_to_human",
    description: "מעביר את השיחה לטיפול אנושי — מעדכן conversation.status=human.",
    input_schema: {
      type: "object",
      properties: {
        conversation_id: { type: "string" },
        reason: { type: "string", description: "סיבת ההסלמה" },
      },
      required: ["conversation_id"],
    },
  },
];
