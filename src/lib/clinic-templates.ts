export type TemplateSection = {
  key: string;
  label: string;       // Hebrew display name
  letter: string;      // 1-2 char abbreviation shown in chip
  color: string;       // Tailwind bg color for chip
  ring: string;        // Tailwind focus ring
  placeholder: string; // shown in empty textarea
  guidance: string;    // sent to Claude to shape the section content
};

export type ClinicalTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: TemplateSection[];
  systemContext: string; // extra Claude context (terminology, phrasing expectations)
};

export const TEMPLATES: ClinicalTemplate[] = [
  {
    id: "ortho_outpatient",
    name: "פיזיותרפיה אורטופדית אמבולטורית",
    description: "לכאבי שלד-שריר, לאחר ניתוח, פציעות ספורט, עמוד שדרה ועוד",
    icon: "🦴",
    systemContext: "קליניקה אורטופדית אמבולטורית. השתמש בטרמינולוגיה כגון ROM, MMT, palpation, ספציפי לבדיקות אורטופדיות (Lachman, SLR, Hawkins, וכדומה). ציין דרגות כאב, טווחי תנועה בדרגות, ועוצמת שריר בסולם Oxford.",
    sections: [
      {
        key: "subjective",
        label: "דיווח סובייקטיבי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "תלונות המטופל, מיקום ואופי הכאב, הגבלות תפקודיות, AVD, שינויים מהטיפול הקודם",
        guidance: "תיאור המטופל: תלונה עיקרית, אופי הכאב (VAS/NRS), מיקום, הקרנות, מחמירים/משפרים, הגבלות ב-ADL, תחושת שינוי מהטיפול הקודם",
      },
      {
        key: "objective",
        label: "ממצאים אובייקטיביים",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "ROM, MMT, palpation, בדיקות ספציפיות, יציבה, הליכה",
        guidance: "ממצאים פיזיקליים: ROM (בדרגות), MMT (Oxford 0-5), palpation, בדיקות אורטופדיות ספציפיות עם תוצאותיהן (חיובי/שלילי), יציבה, הליכה, תפקוד",
      },
      {
        key: "assessment",
        label: "הערכה קלינית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה, שלב הטיפול, התקדמות, פרוגנוזה",
        guidance: "הערכת המטפל: אבחנה פיזיותרפית, שלב (אקוטי/תת-אקוטי/כרוני), התקדמות ביחס ליעדים, גורמים תורמים, פרוגנוזה",
      },
      {
        key: "plan",
        label: "תוכנית טיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "טכניקות, תרגילים, HEP, יעדים, תדירות, הטיפול הבא",
        guidance: "תוכנית: טכניקות טיפול (מניפולציה, מובליזציה, אולטראסאונד וכדומה), תרגילים שבוצעו, תרגילי בית (HEP), יעדים קצרי/ארוכי טווח, תדירות וסה\"כ טיפולים מתוכנן",
      },
    ],
  },
  {
    id: "neuro_outpatient",
    name: "פיזיותרפיה נוירולוגית אמבולטורית",
    description: "שבץ מוחי, טרשת נפוצה, פרקינסון, TBI, פגיעות עמוד שדרה",
    icon: "🧠",
    systemContext: "קליניקה נוירולוגית אמבולטורית. השתמש בסולמות: Barthel, FIM, Berg, MAS (Modified Ashworth), MMSE/MoCA כרלוונטי. ציין תפקוד לפי ICF.",
    sections: [
      {
        key: "subjective",
        label: "דיווח סובייקטיבי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "דיווח מטופל/מטפל עיקרי, יכולות תפקודיות, שינויים מהיום האחרון",
        guidance: "דיווח מטופל או מטפל עיקרי: תפקוד ADL, ניידות, נפילות, שינוי בתפקוד, תרופות חדשות, תלונות נוירולוגיות (ספסטיות, כאב, עייפות)",
      },
      {
        key: "objective",
        label: "ממצאים אובייקטיביים",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "טונוס, קואורדינציה, תחושה, שיווי משקל, הליכה, סולמות תפקוד",
        guidance: "ממצאים: טונוס שרירים (MAS), קואורדינציה, תחושה, שיווי משקל (Berg/BBS), הליכה (מהירות, עזרי הליכה, איכות), תפקוד (Barthel/FIM ציון מספרי), כוח",
      },
      {
        key: "assessment",
        label: "הערכה תפקודית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה, מצב תפקודי, פוטנציאל שיקומי, מגבלות",
        guidance: "הערכה: אבחנה נוירולוגית, רמת תפקוד (ICF), התקדמות ביחס ליעדים, פוטנציאל שיקומי, חסמים (קוגניטיביים, פסיכוסוציאליים)",
      },
      {
        key: "plan",
        label: "תוכנית טיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות, יעדים מוטוריים ותפקודיים, תדירות, מעורבות משפחה",
        guidance: "תוכנית: התערבויות (task-specific training, NDT, נירומובליזציה), יעדי STG/LTG מוטוריים ותפקודיים, HEP, מעורבות משפחה/מטפל עיקרי, תדירות",
      },
    ],
  },
  {
    id: "pediatric_dev",
    name: "פיזיותרפיה ילדים והתפתחות",
    description: "אבחון והתערבות התפתחותית, שיתוק מוחין, עיכוב מוטורי, ספורט ילדים",
    icon: "🧒",
    systemContext: "פיזיותרפיה ילדים. השתמש בציוני מיילסטונים התפתחותיים, GMFCS, GMFM, PEDI. כתוב ביחס לגיל הכרונולוגי וגיל מתוקן כשרלוונטי. כלול גישה Family-Centered Care.",
    sections: [
      {
        key: "subjective",
        label: "דיווח הורים",
        letter: "S",
        color: "bg-pink-500",
        ring: "focus-within:ring-pink-200",
        placeholder: "דיווח ההורים, היסטוריה התפתחותית, תפקוד בבית/גן/בית ספר",
        guidance: "דיווח הורים: שינויים שנצפו בבית, השתתפות בגן/בית ספר, שינה, שיתוף פעולה, יעדי ההורים, תרופות, שינויים רפואיים",
      },
      {
        key: "objective",
        label: "בדיקה מוטורית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "מיילסטונים, GMFM, עיבוד חושי, תפקוד עצמאי, משחק",
        guidance: "ממצאים: מיילסטונים מוטוריים ביחס לגיל, GMFM/PEDI כרלוונטי, טונוס, ROM, עיבוד חושי, משחק, עצמאות בתפקוד, שיתוף פעולה בטיפול",
      },
      {
        key: "assessment",
        label: "הערכה",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "רמה התפתחותית, תחומי חוזק וקושי, שינויים מהטיפול הקודם",
        guidance: "הערכה: רמת תפקוד מוטורי ביחס לגיל, תחומי חוזק ומאתגר, שינוי ביחס ליעדים, ממצאים מיוחדים, המלצות לאנשי מקצוע נוספים",
      },
      {
        key: "plan",
        label: "תוכנית ויעדים",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות, יעדי משפחה, HEP, תדירות, המלצות סביבתיות",
        guidance: "תוכנית: יעדי Family-Centered Care (STG/LTG), משחק טיפולי, הנחיות הורים, HEP התאמות סביבתיות, תדירות, שיתוף עם גן/בית ספר",
      },
    ],
  },
  {
    id: "rehabilitation",
    name: "שיקום",
    description: "שיקום רב-מקצועי אחרי אשפוז, ניתוח, שבץ, פציעה",
    icon: "🔄",
    systemContext: "מסגרת שיקומית. עבוד עם FIM, Barthel, ציוני ניידות, יעדי STG/LTG מדידים. ציין מעורבות צוות רב-מקצועי כרלוונטי (ריפוי בעיסוק, קלינאי תקשורת, סייעת שיקום).",
    sections: [
      {
        key: "subjective",
        label: "מצב תפקודי נוכחי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "דיווח המטופל/משפחה על מצב תפקודי, כאב, מוטיבציה, חסמים",
        guidance: "מצב עדכני: יכולות ADL, רמת עצמאות, כאב, מוטיבציה, תמיכה משפחתית, חסמי שיקום, ציפיות",
      },
      {
        key: "objective",
        label: "הערכה פונקציונלית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "ניידות, העברות, ADL, Barthel/FIM, כוח, ROM",
        guidance: "ממצאים: ניידות (עצמאית/בעזרה/עזרה מלאה), העברות, הליכה (מרחק, עזרים), ADL (רחצה, לבוש, האכלה), Barthel/FIM ציון, כוח, ROM",
      },
      {
        key: "assessment",
        label: "הערכה שיקומית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "פוטנציאל שיקומי, התקדמות, חסמים, ציר זמן",
        guidance: "פוטנציאל שיקומי, התקדמות ביחס ל-STG/LTG קודמים, חסמים (רפואיים, מוטיבציה, משפחתיים), עדכון ציר זמן לשחרור",
      },
      {
        key: "plan",
        label: "תוכנית STG/LTG",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "יעדי STG ו-LTG מדידים, התערבויות, ציוד, תדירות, תכנון שחרור",
        guidance: "יעדי STG (שבוע הבא) ו-LTG (שחרור) — SMART, התערבויות, ציוד מסייע נדרש, תכנון שחרור, המלצות לקהילה",
      },
    ],
  },
  {
    id: "inpatient_acute",
    name: "פיזיותרפיה בבית חולים — אקוטי",
    description: "הערכה וטיפול בביה\"ח: לאחר ניתוח, מחלה חריפה, ICU step-down",
    icon: "🏥",
    systemContext: "מסגרת אשפוז חריפה. ציין הנחיות הרמת עומס, מגבלות רפואיות, ציוד קצה המיטה, ציון תפקוד עם ספציפיות מירבית (עצמאי/עצמאי עם ציוד/פיקוח/עזרה מינימלית-מקסימלית/תלוי מלא). ציין סיכון נפילות.",
    sections: [
      {
        key: "background",
        label: "רקע רפואי ורקע",
        letter: "B",
        color: "bg-red-500",
        ring: "focus-within:ring-red-200",
        placeholder: "סיבת אשפוז, היסטוריה רפואית רלוונטית, סטטוס תפקודי ערב אשפוז",
        guidance: "רקע: סיבת אשפוז ותאריך, פרוצדורות רלוונטיות, מגבלות רפואיות (Weight-bearing, sternal precautions), רמת תפקוד לפני אשפוז (baseline)",
      },
      {
        key: "objective",
        label: "בדיקה גופנית ותפקודית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "ניידות, העברות, הליכה, נשימה, כוח, תחושה, סיכון נפילות",
        guidance: "ממצאים: ניידות עצמאות (ספציפי לרמה), הליכה (מרחק, עזרים), העברות, נשימה (SPO2, קיבולת נשימתית), כוח, ROM, הכרה ושיתוף פעולה, סיכון נפילות (Morse/STRATIFY)",
      },
      {
        key: "assessment",
        label: "הערכה",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "מצב תפקודי, עמידה ביחס לסטנדרט לאחר הפרוצדורה, מוכנות לשחרור",
        guidance: "הערכה: מצב תפקודי ביחס לציפיות לשלב, סיכונים פיזיים (נפילות, פצעי לחץ), מוכנות לשחרור/העברה למוסד, חסמים",
      },
      {
        key: "plan",
        label: "המלצות וטיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות, תרגילים, ציוד מסייע, יעד שחרור, המלצות לפיזיותרפיה בקהילה",
        guidance: "תוכנית: התערבויות, הנחיות גיוס, ציוד נדרש בשחרור, יעד שחרור (הבית/מוסד שיקומי), המלצות לפיזיותרפיה בקהילה ותדירות",
      },
    ],
  },
  {
    id: "pelvic_floor",
    name: "פיזיותרפיה רצפת אגן",
    description: "אי שליטה בשתן/צואה, כאבי אגן, שיקום לאחר לידה, שיקום סרטן",
    icon: "🌸",
    systemContext: "פיזיותרפיה של רצפת האגן. השתמש בסולמות PISQ, PFDI, ICQ כרלוונטי. ציין ממצאי בדיקה פנימית בשפה מקצועית ומכבדת. כלול: טונוס (היפרטוני/היפוטוני), כוח (Oxford 0-5), coordinated relaxation.",
    sections: [
      {
        key: "subjective",
        label: "תלונות ותפקוד אגני",
        letter: "S",
        color: "bg-pink-500",
        ring: "focus-within:ring-pink-200",
        placeholder: "שתן, מעיים, תפקוד מיני, כאב, היסטוריה מיילדותית",
        guidance: "תלונות: תדירות השתן, דחיפות, דליפות (מאמץ/דחיפות), כאב (מיקום, אופי, מחמירים), תפקוד מיני, הפרעות מעי, היסטוריה מיילדותית (לידות, קרעים, ניתוחים), שימוש בפדים",
      },
      {
        key: "objective",
        label: "בדיקה פנימית וחיצונית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "בדיקה חיצונית (צלקות, דרמה, reflexes), בדיקה פנימית (טונוס, כוח, תיאום)",
        guidance: "בדיקה חיצונית: עור, צלקות, reflexes (אנאלי, פריאנאלי). בדיקה פנימית (אם בוצעה): טונוס (היפרטוני/נורמוטוני/היפוטוני), כוח Oxford 0-5, תיאום, trigger points, פרולפס (POP-Q)",
      },
      {
        key: "assessment",
        label: "הערכה קלינית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה פיזיותרפית, גורמים תורמים, פרוגנוזה",
        guidance: "אבחנה פיזיותרפית: סוג הכשל (תת-פעילות/יתר-פעילות), גורמים תורמים (כושר, postural, פסיכוסוציאלי), תגובה לטיפול הקודם, פרוגנוזה",
      },
      {
        key: "plan",
        label: "תוכנית טיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "טכניקות, Kegel/Down-training, HEP, ייעוץ, יעדים",
        guidance: "תוכנית: טכניקות (ביופידבק, NMES, מניפולציות, דאון-טריינינג), HEP מותאם, ייעוץ (מזון, שתייה, רגלי שירותים), יעדי STG/LTG, תדירות",
      },
    ],
  },
  {
    id: "vestibular",
    name: "שיקום וסטיבולרי",
    description: "BPPV, וסטיבולר יוניל/ביל, neuritis, פוסט-קונקוסיה, ראש-סחרחורת",
    icon: "🌀",
    systemContext: "שיקום וסטיבולרי. ציין תוצאות בדיקות: Dix-Hallpike (ימין/שמאל, latency, nystagmus type, duration), Roll test, head impulse test, HINTS. ציין DHI ציון, סוג nystagmus (geotropic/apogeotropic), ואיזה תמרון CRT בוצע.",
    sections: [
      {
        key: "subjective",
        label: "תלונות ראש-סחרחורת",
        letter: "S",
        color: "bg-indigo-500",
        ring: "focus-within:ring-indigo-200",
        placeholder: "אופי הסחרחורת, טריגרים, משך, DHI, נפילות, בחילות",
        guidance: "תלונות: אופי (vertigo/dizziness/unsteadiness), טריגרים (תנוחה/ראש/שינה), משך (שניות/דקות/קבוע), DHI ציון מספרי, נפילות, בחילות, ממצאים אחרים (טינטון, ירידת שמיעה), תפקוד יומי",
      },
      {
        key: "objective",
        label: "בדיקות וסטיבולריות ושיווי משקל",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "Dix-Hallpike, Roll test, HIT, שיווי משקל, הליכה, nystagmus",
        guidance: "בדיקות: Dix-Hallpike (ימין/שמאל — latency, nystagmus direction, duration), Roll test, head impulse test, VOR gain estimation, Romberg/Tandem Romberg, שיווי משקל (Berg), הליכה וביטחון",
      },
      {
        key: "assessment",
        label: "אבחנה וסטיבולרית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "BPPV (תעלה ספציפית), וסטיבולר יוניל/ביל, מרכזי, תגובה לטיפול",
        guidance: "אבחנה: BPPV (תעלה ספציפית — קשת/עגול/אופקי), וסטיבולריטיס, נוירופתיה וסטיבולרית, מרכזי (אם רלוונטי). תגובה לטיפול, שינוי ב-DHI, סיכון נפילות",
      },
      {
        key: "plan",
        label: "תמרונים וטיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "CRT שבוצע, תרגילי VOR/habituation, HEP, הגבלות, מעקב",
        guidance: "טיפול: CRT שבוצע (Epley/Semont/BBQ roll — תיאור מלא), תגובת המטופל, תרגילי VOR/habituation/balance HEP, הגבלות (נהיגה, שינה), תדירות, מתי לחזור אם חוזר",
      },
    ],
  },
];

export const TEMPLATE_MAP: Record<string, ClinicalTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t])
);

export const DEFAULT_TEMPLATE_ID = "ortho_outpatient";

const FALLBACK_COLORS = [
  { color: "bg-sky-500", ring: "focus-within:ring-sky-200" },
  { color: "bg-emerald-500", ring: "focus-within:ring-emerald-200" },
  { color: "bg-amber-500", ring: "focus-within:ring-amber-200" },
  { color: "bg-violet-500", ring: "focus-within:ring-violet-200" },
  { color: "bg-rose-500", ring: "focus-within:ring-rose-200" },
  { color: "bg-indigo-500", ring: "focus-within:ring-indigo-200" },
];

/** Resolve a ClinicalTemplate from raw clinics.settings JSONB (client-safe). */
export function resolveTemplateFromSettings(settings: unknown): ClinicalTemplate {
  const s = settings as Record<string, any> | null | undefined;
  const id: string = s?.template_id ?? DEFAULT_TEMPLATE_ID;

  if (id === "custom") {
    const raw: unknown[] = Array.isArray(s?.template_sections) ? s!.template_sections : [];
    const sections: TemplateSection[] = raw
      .filter((r): r is Record<string, any> => !!r && typeof r === "object" && typeof (r as any).key === "string" && typeof (r as any).label === "string")
      .map((r, i) => ({
        key: r.key,
        label: r.label,
        letter: r.letter ?? r.key.slice(0, 2).toUpperCase(),
        color: r.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length].color,
        ring: r.ring ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length].ring,
        placeholder: r.placeholder ?? "",
        guidance: r.guidance ?? r.label,
      }));
    if (sections.length > 0) {
      return {
        id: "custom",
        name: s?.template_name ?? "תבנית מותאמת אישית",
        description: "תבנית מותאמת אישית",
        icon: "📋",
        sections,
        systemContext: s?.template_system_context ?? "",
      };
    }
  }

  return TEMPLATE_MAP[id] ?? TEMPLATE_MAP[DEFAULT_TEMPLATE_ID];
}

/** Build the Claude system prompt for a given template */
export function buildSoapPrompt(template: ClinicalTemplate): string {
  const fieldDefs = template.sections
    .map((s) => `  "${s.key}": "${s.guidance}"`)
    .join(",\n");
  const keys = template.sections.map((s) => `"${s.key}"`).join(", ");

  return `אתה עוזר קליני לפיזיותרפיסטים בישראל. קיבלת תמלול של שיחת טיפול פיזיותרפי.
הקליניקה עובדת בפורמט: ${template.name}.
${template.systemContext}

תפקידך לחלץ את המידע ולהחזיר רשומה קלינית מובנית בעברית.

החזר JSON בלבד בפורמט הבא (מפתחות: ${keys}):
{
${fieldDefs}
}

כללים:
- כתוב בעברית, בשפה קלינית מקצועית ותמציתית
- אם מידע לא הוזכר — השאר את השדה ריק (מחרוזת ריקה)
- אל תמציא מידע שלא מופיע בתמלול
- הוסף מינוח מקצועי מתאים לסוג הקליניקה שם שזה הגיוני מהקשר`;
}
