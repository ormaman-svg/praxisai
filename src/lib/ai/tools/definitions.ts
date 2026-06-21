import type { ToolDefinition } from "../invoke";

export const PATIENT_AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "list_available_slots",
    description:
      "מחזיר תורים פנויים אמיתיים מהיומן של הקליניקה, לפי שעות הפעילות והתורים הקיימים. " +
      "השתמש בכלי זה כשמטופל (גם לא רשום) מבקש לקבוע תור, לפני שאתה מציע זמנים. " +
      "התוצאה כוללת starts_at ו-therapist_id מדויקים שיש להעביר ל-book_appointment.",
    input_schema: {
      type: "object",
      properties: {
        urgency: {
          type: "string",
          enum: ["urgent", "this_week", "flexible"],
          description: "'urgent' = הקרוב ביותר האפשרי; 'this_week' = השבוע; 'flexible' = גמיש.",
        },
      },
    },
  },
  {
    name: "book_appointment",
    description:
      "קובע תור ביומן בפועל. לפני קריאה — ודא שיש לך שם מלא של הפונה ושקיבלת ממנו אישור לזמן מסוים. " +
      "אם הפונה אינו מטופל רשום, מסור first_name ו-last_name ותיווצר עבורו רשומת מטופל חדשה אוטומטית. " +
      "מסור starts_at ו-therapist_id בדיוק כפי שהוחזרו מ-list_available_slots.",
    input_schema: {
      type: "object",
      properties: {
        starts_at: { type: "string", description: "זמן התחלה ISO 8601 (UTC) — בדיוק כפי שהוחזר מ-list_available_slots" },
        therapist_id: { type: "string", description: "מזהה המטפל מהתור הפנוי (אם הוחזר)" },
        first_name: { type: "string", description: "שם פרטי של הפונה (חובה אם אינו מטופל רשום)" },
        last_name: { type: "string", description: "שם משפחה של הפונה (חובה אם אינו מטופל רשום)" },
        national_id: { type: "string", description: "תעודת זהות של הפונה — נאספת בתהליך הרישום לפני קביעת התור הראשון (חובה לפונה חדש)" },
        reason: { type: "string", description: "סיבת הפנייה / תלונה עיקרית (אופציונלי)" },
        duration_minutes: { type: "number", description: "משך התור בדקות (ברירת מחדל: לפי הגדרות הקליניקה)" },
      },
      required: ["starts_at"],
    },
  },
  {
    name: "send_verification_sms",
    description:
      "שולח קוד אימות חד-פעמי ב-SMS לנייד הרשום של המטופל, לפני מסירת מידע רפואי אישי או היסטוריית טיפולים. " +
      "השתמש כאשר המטופל מבקש מידע אישי וצריך לאמת את זהותו. לאחר מכן בקש ממנו את הקוד וקרא ל-verify_sms_code.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "verify_sms_code",
    description:
      "מאמת את הקוד החד-פעמי שהמטופל קיבל ב-SMS. השתמש לאחר send_verification_sms וקבלת הקוד מהמטופל.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "הקוד בן 4 הספרות שהמטופל מסר" },
      },
      required: ["code"],
    },
  },
  {
    name: "get_patient_history",
    description:
      "מחזיר מידע אישי של המטופל: פגישות עבר ועתיד, טיפולים קודמים ותוכנית תרגול פעילה. " +
      "דורש שהמטופל יהיה מאומת תחילה (verify_identity_id או verify_sms_code). " +
      "אם המטופל אינו מאומת — הכלי יחזיר בקשה לאימות; אל תמסור מידע אישי ללא אימות.",
    input_schema: { type: "object", properties: {} },
  },
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
