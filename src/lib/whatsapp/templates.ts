// Catalog of Meta-approved WhatsApp message templates.
// Each entry maps a local key to the template name registered in the WABA.
// vars: ordered list of variable placeholders ({{1}}, {{2}}, ...) filled at send time.

export const TEMPLATES = {
  reminder_24h: {
    name: "appointment_reminder_24h",
    language: "he",
    vars: ["patient_first_name", "time_hhmm", "therapist_name"],
    // "שלום {1}, תזכורת לטיפול מחר בשעה {2} עם {3}. השיבו אישור/ביטול."
  },
  reminder_2h: {
    name: "appointment_reminder_2h",
    language: "he",
    vars: ["patient_first_name", "time_hhmm"],
    // "שלום {1}, טיפולך מתחיל בעוד כ-2 שעות בשעה {2}. נתראה!"
  },
  arrival_confirm: {
    name: "arrival_confirmation",
    language: "he",
    vars: ["patient_first_name"],
    // "שלום {1}, האם הגעתם היום לקליניקה? (כן/לא)"
  },
  payment_request: {
    name: "payment_request",
    language: "he",
    vars: ["patient_first_name", "amount", "description", "pay_link"],
    // "שלום {1}, יתרתכם לתשלום: {2} ₪ עבור {3}. לתשלום מאובטח: {4}"
  },
  hep_nudge: {
    name: "hep_daily_nudge",
    language: "he",
    vars: ["patient_first_name"],
    // "שלום {1}, האם ביצעת את תרגילי הבית? שלחו: כן/לא + רמת כאב 0-10"
  },
  prom_collect: {
    name: "prom_weekly",
    language: "he",
    vars: ["patient_first_name", "scale_label"],
    // "שלום {1}, שאלון שבועי: כיצד הרגשתם מבחינת {2}? שלחו ציון 0-10"
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

// Render a template to plain Hebrew text. Used by channels that have no
// approved templates (e.g. Green API), and as the message body in our inbox.
export function renderTemplateText(key: string, vars: string[]): string {
  const v = (i: number) => vars[i] ?? "";
  switch (key) {
    case "free_text":
      return v(0);
    case "reminder_24h":
      return `שלום ${v(0)}, תזכורת לטיפול מחר בשעה ${v(1)} עם ${v(2)}. השיבו אישור או ביטול.`;
    case "reminder_2h":
      return `שלום ${v(0)}, טיפולך מתחיל בעוד כשעתיים בשעה ${v(1)}. נתראה!`;
    case "arrival_confirm":
      return `שלום ${v(0)}, האם הגעתם היום לקליניקה? (כן/לא)`;
    case "payment_request":
      return `שלום ${v(0)}, יתרתכם לתשלום: ${v(1)} ₪ עבור ${v(2)}.${v(3) ? ` לתשלום מאובטח: ${v(3)}` : ""}`;
    case "hep_nudge":
      return `שלום ${v(0)}, האם ביצעת היום את תרגילי הבית? שלחו: כן/לא + רמת כאב 0-10`;
    case "prom_collect":
      return `שלום ${v(0)}, שאלון שבועי: כיצד הרגשתם מבחינת ${v(1)}? שלחו ציון 0-10`;
    default:
      return v(0);
  }
}
