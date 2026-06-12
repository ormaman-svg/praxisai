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
  profession: string; // Hebrew profession group label
  scale_label: string; // label for the 0–10 outcome measure shown in analytics
  scale_improvement_lower: boolean; // true = lower score is better (pain), false = higher is better (function)
  sections: TemplateSection[];
  systemContext: string; // extra Claude context (terminology, phrasing expectations)
};

export const TEMPLATES: ClinicalTemplate[] = [
  {
    id: "ortho_outpatient",
    name: "פיזיותרפיה אורטופדית אמבולטורית",
    description: "לכאבי שלד-שריר, לאחר ניתוח, פציעות ספורט, עמוד שדרה ועוד",
    icon: "🦴",
    profession: "פיזיותרפיה",
    scale_label: "VAS כאב",
    scale_improvement_lower: true,
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
    profession: "פיזיותרפיה",
    scale_label: "ציון תפקוד (FIM)",
    scale_improvement_lower: false,
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
    profession: "פיזיותרפיה",
    scale_label: "ציון התפתחות",
    scale_improvement_lower: false,
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
    profession: "פיזיותרפיה",
    scale_label: "ציון תפקוד (Barthel)",
    scale_improvement_lower: false,
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
    profession: "פיזיותרפיה",
    scale_label: "VAS כאב",
    scale_improvement_lower: true,
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
    profession: "פיזיותרפיה",
    scale_label: "VAS כאב",
    scale_improvement_lower: true,
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
    profession: "פיזיותרפיה",
    scale_label: "ציון תסמינים (DHI)",
    scale_improvement_lower: true,
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
  // ── קלינאות תקשורת ────────────────────────────────────────────────────
  {
    id: "slp_adult",
    name: "קלינאות תקשורת — מבוגרים",
    description: "אפזיה, דיספגיה, הפרעות קול, דיסארתריה, קוגניציה-תקשורת",
    icon: "🗣️",
    profession: "קלינאות תקשורת",
    scale_label: "ציון תפקוד תקשורת",
    scale_improvement_lower: false,
    systemContext: "קליניקת קלינאות תקשורת — מבוגרים. השתמש בסולמות: WAB-R, BDAE, ASHA NOMS, VHI, DOSS, MBS/FEES כרלוונטי. ציין רמת חומרה, אמצעי תקשורת חלופית (AAC) אם רלוונטי, ורמת תפקוד לפי ICF.",
    sections: [
      {
        key: "subjective",
        label: "דיווח סובייקטיבי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "תלונות המטופל/משפחה, שינויים מהטיפול הקודם, מוטיבציה, תפקוד תקשורתי יומי",
        guidance: "דיווח: תלונות תקשורתיות עיקריות (שפה, דיבור, קול, בליעה), שינויים מהטיפול הקודם, תפקוד תקשורתי בסביבה הטבעית, מוטיבציה, תמיכה משפחתית",
      },
      {
        key: "objective",
        label: "הערכה תקשורתית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "שפה קולטת/מבטאת, דיבור, קול, בליעה, קוגניציה-תקשורת, ממצאי סולמות",
        guidance: "ממצאים: שפה קולטת ומבטאת (מילים/משפטים/שיח), דיבור (ארטיקולציה, פלואנטיות, קצב), קול (איכות, עוצמה, טווח), בליעה (רמת מרקם לפי IDDSI), קוגניציה-תקשורת (זיכרון, קשב, ביצוע), ציוני סולמות",
      },
      {
        key: "assessment",
        label: "הערכה קלינית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה תקשורתית, חוזקות וקשיים, פרוגנוזה, השפעה תפקודית",
        guidance: "הערכה: אבחנה תקשורתית (סוג וחומרה), תחומי חוזק ומאתגר, התקדמות ביחס ליעדים, גורמים תורמים, פרוגנוזה, השפעה על השתתפות חברתית",
      },
      {
        key: "plan",
        label: "תוכנית טיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "גישות טיפוליות, יעדי STG/LTG, HEP, AAC, הדרכת משפחה, תדירות",
        guidance: "תוכנית: גישות טיפוליות (CILT, LSVT, SFA, VitalStim וכדומה), יעדי STG/LTG מדידים, תרגול עצמאי (HEP), AAC אם נדרש, הדרכת משפחה/מטפלים, תדירות",
      },
    ],
  },
  {
    id: "slp_pediatric",
    name: "קלינאות תקשורת — ילדים",
    description: "עיכוב שפה, הפרעות דיבור, ASD, גמגום, קשיי קריאה",
    icon: "🌱",
    profession: "קלינאות תקשורת",
    scale_label: "ציון התפתחות שפה",
    scale_improvement_lower: false,
    systemContext: "קלינאות תקשורת ילדים. השתמש בציוני מיילסטונים שפתיים (CDI, MCDI), סולמות: PLS-5, GFTA-3, CELF, ADOS-2 כרלוונטי. ציין גיל כרונולוגי ורמת שפה מתקדמת ביחס לגיל. גישת Family-Centered Care.",
    sections: [
      {
        key: "subjective",
        label: "דיווח הורים",
        letter: "S",
        color: "bg-pink-500",
        ring: "focus-within:ring-pink-200",
        placeholder: "חששות הורים, תפקוד תקשורתי בבית/גן, שינויים, מוטיבציה, סביבה לשונית",
        guidance: "דיווח הורים: חששות תקשורתיים, שינויים מהטיפול הקודם, תפקוד בגן/בית ספר, אינטראקציה חברתית, שפות בסביבה הביתית, מוטיבציה וסביבת תקשורת",
      },
      {
        key: "objective",
        label: "הערכת שפה ודיבור",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "שפה קולטת/מבטאת, פונולוגיה, פרגמטיקה, משחק תקשורתי, ממצאי סולמות",
        guidance: "ממצאים: שפה קולטת (הבנת מילים/משפטים/שיח), שפה מבטאת (אוצר מילים, מבנה משפטי, שיח), פונולוגיה (תהליכים פונולוגיים, intelligibility), פרגמטיקה (יוזמה, תורנות, עין), ציוני סולמות",
      },
      {
        key: "assessment",
        label: "הערכה",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "רמת שפה ביחס לגיל, תחומי קושי, השפעה על השתתפות, פרוגנוזה",
        guidance: "הערכה: רמת שפה ודיבור ביחס לגיל כרונולוגי, תחומי חוזק ומאתגר, השפעה על השתתפות בגן/בית ספר, גורמים תורמים, פרוגנוזה, המלצות לאנשי מקצוע נוספים",
      },
      {
        key: "plan",
        label: "תוכנית ויעדים",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "גישות טיפוליות, יעדי Family-Centered Care, הנחיות הורים, HEP, תדירות",
        guidance: "תוכנית: גישות (DIR/Floortime, PRT, Hanen, Articulation Therapy), יעדי STG/LTG עם ביצוע מדיד, הנחיית הורים לתרגול בבית, תדירות, שיתוף עם גן/בית ספר",
      },
    ],
  },
  // ── ריפוי בעיסוק ──────────────────────────────────────────────────────
  {
    id: "ot_adult",
    name: "ריפוי בעיסוק — מבוגרים",
    description: "שיקום יד, ADL, קוגניציה, חזרה לעבודה, אדפטציה סביבתית",
    icon: "🤲",
    profession: "ריפוי בעיסוק",
    scale_label: "ציון עצמאות תפקודית",
    scale_improvement_lower: false,
    systemContext: "ריפוי בעיסוק מבוגרים. השתמש ב-MOHO, COPM, FIM, AMPS, כוח אחיזה (דינמומטר), Pinch כרלוונטי. ציין תפקוד לפי ICF — body function, activity, participation. כלול הערכת סיכון נפילות/בטיחות בית כרלוונטי.",
    sections: [
      {
        key: "subjective",
        label: "פרופיל עיסוקי",
        letter: "S",
        color: "bg-orange-500",
        ring: "focus-within:ring-orange-200",
        placeholder: "תפקידים עיסוקיים, יעדי המטופל (COPM), תחומי קושי, סביבה ביתית/תעסוקתית",
        guidance: "פרופיל עיסוקי: תפקידים משמעותיים (עבודה, פנאי, ADL), יעדי המטופל (COPM — ביצוע ושביעות רצון), שינויים מהטיפול הקודם, סביבה ביתית ותמיכה חברתית",
      },
      {
        key: "objective",
        label: "הערכת ביצוע עיסוקי",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "ADL/IADL, כוח יד, ROM, קוגניציה, ממצאי סולמות תפקודיים",
        guidance: "ממצאים: ADL (רחצה, לבוש, האכלה, רמת עצמאות), IADL (בישול, ניקיון, תרופות), כוח אחיזה/פינצ׳, ROM יד/מרפק/כתף, קוגניציה (זיכרון, קשב, ביצוע, orientiation), AMPS/FIM ציון",
      },
      {
        key: "assessment",
        label: "הערכה תפקודית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "מצב תפקודי, חסמים לביצוע עיסוקי, התקדמות ביחס ליעדים",
        guidance: "הערכה: מצב תפקודי ביחס לתפקידים עיסוקיים, גורמים מגבילים (גופניים, קוגניטיביים, סביבתיים), התקדמות ביחס ל-COPM ויעדים, פרוגנוזה לעצמאות",
      },
      {
        key: "plan",
        label: "תוכנית התערבות",
        letter: "I",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות, אדפטציה, ציוד מסייע, HEP, יעדים, תדירות",
        guidance: "תוכנית: התערבויות (splinting, exercise, cognitive rehab, sensory integration), אדפטציה סביבתית, ציוד מסייע (עזרי ADL), HEP, יעדי STG/LTG מדידים, תדירות",
      },
    ],
  },
  {
    id: "ot_pediatric",
    name: "ריפוי בעיסוק — ילדים",
    description: "עיבוד חושי, DCD, כתיבה, השתתפות בגן/בית ספר, ADL ילדים",
    icon: "🎨",
    profession: "ריפוי בעיסוק",
    scale_label: "ציון עצמאות תפקודית",
    scale_improvement_lower: false,
    systemContext: "ריפוי בעיסוק ילדים. השתמש ב-SPM, Sensory Profile, VMI, Peabody, MABC-2, BOT-2 כרלוונטי. ציין רמת השתתפות בגן/בית ספר, גישת Sensory Integration (SI), Family-Centered Care.",
    sections: [
      {
        key: "subjective",
        label: "דיווח הורים",
        letter: "S",
        color: "bg-pink-500",
        ring: "focus-within:ring-pink-200",
        placeholder: "חששות הורים, תפקוד בבית/גן/בית ספר, ADL ילדים, קשיים חברתיים",
        guidance: "דיווח הורים: קשיים עיקריים (לבישה, כתיבה, משחק, חברתי), תפקוד בגן/בית ספר, התנהגות חושית (רגישות/חיפוש), שינויים מהטיפול הקודם, סביבה ותמיכה",
      },
      {
        key: "objective",
        label: "הערכה תפקודית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "עיבוד חושי, מוטוריקה עדינה/גסה, כתיבה, ADL, השתתפות, ממצאי סולמות",
        guidance: "ממצאים: עיבוד חושי (Sensory Profile/SPM ממצאים), מוטוריקה עדינה (grip, dexterity, VMI), מוטוריקה גסה (MABC-2), כתיבה (מהירות, קריאות), ADL (לבישה, היגיינה), השתתפות בגן/כיתה",
      },
      {
        key: "assessment",
        label: "הערכה",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "פרופיל חושי, קשיי ביצוע, השפעה על השתתפות, שינויים מהטיפול",
        guidance: "הערכה: פרופיל חושי (under/over-responsive), קשיי ביצוע (praxis, bilateral coordination), השפעה על השתתפות (גן/בית ספר/חברתי), התקדמות ביחס ליעדים, המלצות לאנשי מקצוע נוספים",
      },
      {
        key: "plan",
        label: "תוכנית ויעדים",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "SI, תרגולי ADL, הנחיות הורים/מורים, HEP, תדירות, שיתוף בית ספר",
        guidance: "תוכנית: גישות SI/occupation-based, תרגולי ADL ספציפיים, הנחיות הורים ומורים, HEP, יעדי STG/LTG עם ביצוע מדיד, תדירות, שיתוף עם גן/בית ספר",
      },
    ],
  },
  // ── תזונה קלינית ──────────────────────────────────────────────────────
  {
    id: "dietetics",
    name: "תזונה קלינית",
    description: "הערכה תזונתית, תכנון תפריט, ניהול מחלות כרוניות, ירידה/עלייה במשקל",
    icon: "🥗",
    profession: "תזונה קלינית",
    scale_label: "מדד היצמדות לתוכנית",
    scale_improvement_lower: false,
    systemContext: "קליניקת תזונה קלינית. השתמש ב-BMI, %IBW, SGA, MNA, Harris-Benedict/Mifflin-St Jeor לחישוב צרכים קלוריים. ציין מדדים אנתרופומטריים, ממצאי בדיקות דם רלוונטיות, ורמת פעילות גופנית.",
    sections: [
      {
        key: "subjective",
        label: "היסטוריה תזונתית",
        letter: "S",
        color: "bg-lime-500",
        ring: "focus-within:ring-lime-200",
        placeholder: "תלונות, שינויי משקל, הרגלי אכילה, אלרגיות, תרופות, מוטיבציה",
        guidance: "היסטוריה: תלונות ומטרת פנייה, שינויי משקל (כמה ק\"ג, בכמה זמן), הרגלי אכילה ושתייה, אלרגיות ואי-סבילות, תרופות משפיעות על תזונה, פעילות גופנית, מוטיבציה ומכשולים",
      },
      {
        key: "objective",
        label: "הערכה תזונתית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "אנתרופומטריה (BMI, היקפים), בדיקות דם רלוונטיות, צריכה תזונתית",
        guidance: "ממצאים: אנתרופומטריה (משקל, גובה, BMI, היקף מותן/ירך, % שומן), בדיקות דם (גלוקוז, HbA1c, שומנים, סידן, ויטמין D, ברזל וכדומה), ניתוח צריכה תזונתית (קלוריות, מאקרו, מיקרו), SGA/MNA",
      },
      {
        key: "assessment",
        label: "הערכה ותחשיב תזונתי",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה תזונתית, צרכים קלוריים מחושבים, חסרים תזונתיים, יעדים",
        guidance: "הערכה: אבחנה תזונתית (תת-תזונה/השמנה/חסר ספציפי), צרכים קלוריים מחושבים (מחושב בנוסחה), חסרי ויטמינים/מינרלים, עומסים גליקמיים, התקדמות ביחס ליעדים",
      },
      {
        key: "plan",
        label: "תוכנית תזונה",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "תפריט ממליץ, יעד קלורי, תוספים, יעד משקל, מעקב, מעורבות רב-מקצועית",
        guidance: "תוכנית: יעד קלורי ויחס מאקרונוטריאנטים, תפריט לדוגמה, תוספי תזונה מומלצים, יעד משקל ותזמון, המלצות לפעילות גופנית, תדירות מעקב, שיתוף עם רופא/דיאטנית נוספת",
      },
    ],
  },
  // ── סיעוד קהילתי ──────────────────────────────────────────────────────
  {
    id: "nursing_community",
    name: "סיעוד קהילתי",
    description: "ביקורי בית, טיפול בפצעים, ניהול תרופות, ניטור כרוני, קשישים",
    icon: "💊",
    profession: "סיעוד",
    scale_label: "ציון מצב כללי",
    scale_improvement_lower: false,
    systemContext: "סיעוד קהילתי. ציין סימנים חיוניים בערכים מדויקים, מצב פצע לפי סולם PUSH, רמת תפקוד לפי Barthel/Katz, ורמת ביצוע ADL. השתמש בטרמינולוגיה NANDA לאבחנות סיעודיות.",
    sections: [
      {
        key: "subjective",
        label: "תלונות ומצב נוכחי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "תלונות עדכניות, ציות לתרופות, שינויים, תמיכה משפחתית, סביבה ביתית",
        guidance: "דיווח: תלונות עיקריות מאז ביקור קודם, ציות לתרופות (מי נותן, האם לוקח), שינויים במצב הכללי, תמיכה משפחתית ומטפל עיקרי, סביבת בית ובטיחות",
      },
      {
        key: "objective",
        label: "ממצאי בדיקה",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "סימנים חיוניים, מצב פצע, צנתרים, בדיקות סוכר/לחץ דם, מצב תודעה",
        guidance: "ממצאים: סימנים חיוניים (BP, HR, RR, SpO2, Temp, glucose), מצב פצעים (מיקום, גודל, עומק, הפרשה, PUSH score), צנתרים/זנדות (סוג, תאריך הכנסה, מצב), מצב תודעה ואוריינטציה, Barthel/Katz",
      },
      {
        key: "assessment",
        label: "הערכה סיעודית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנות סיעודיות, שינוי ממצב קודם, סיכונים, יעדים מותאמים",
        guidance: "הערכה: אבחנות סיעודיות (NANDA), השוואה לביקור קודם (שיפור/החמרה/יציב), סיכוני נפילות/פצעי לחץ/זיהום, עמידה ביעדים קודמים, שינויים נדרשים בטיפול",
      },
      {
        key: "plan",
        label: "תוכנית סיעודית",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות, טיפול בפצע, תרופות, הוראות למטפל, תדירות מעקב",
        guidance: "תוכנית: התערבויות סיעודיות (החלפת תחבושת, ניהול תרופות, הדרכה), תדירות ביקורים, הוראות למטפל עיקרי, תנאי פנייה דחופה, תיאום עם רופא/ספציאליסט",
      },
    ],
  },
  // ── פסיכולוגיה קלינית ────────────────────────────────────────────────
  {
    id: "psychology_clinical",
    name: "פסיכולוגיה קלינית",
    description: "CBT, DBT, חרדה, דיכאון, PTSD, הערכה פסיכולוגית, פסיכותרפיה",
    icon: "🧩",
    profession: "פסיכולוגיה קלינית",
    scale_label: "ציון מצוקה נפשית",
    scale_improvement_lower: true,
    systemContext: "פסיכולוגיה קלינית. השתמש בסולמות: PHQ-9, GAD-7, PCL-5, BDI, BAI, MSE כרלוונטי. ציין ניקוד מדד סיכון לפגיעה עצמית (C-SSRS). ערוך הערכת MSE בשפה פסיכיאטרית מקצועית.",
    sections: [
      {
        key: "subjective",
        label: "הצגה ועדכון",
        letter: "S",
        color: "bg-purple-500",
        ring: "focus-within:ring-purple-200",
        placeholder: "מצב רוח, תפקוד, אירועים מאז הפגישה הקודמת, עמידה במשימות בית",
        guidance: "עדכון: מצב רוח ורגשות (תיאור המטופל עצמו), תפקוד יומיומי (עבודה, חברתי, שינה, תיאבון), אירועים משמעותיים מאז הפגישה הקודמת, עמידה במשימות בית טיפוליות, שינויים בתרופות",
      },
      {
        key: "objective",
        label: "בחינת המצב הנפשי (MSE)",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "הופעה, דיבור, מצב רוח/השפעה, מחשבות, תפיסה, קוגניציה, סיכון",
        guidance: "MSE: הופעה כללית, קשר עין, דיבור (קצב, נפח, קוהרנטיות), מצב רוח (subjective) ו-affect (objective), תוכן מחשבתי (דאגות, רומינציות, אובדנות), תפיסה, קוגניציה, סיכון עצמי (C-SSRS), ציוני סולמות PHQ-9/GAD-7",
      },
      {
        key: "assessment",
        label: "הערכה פסיכולוגית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה, פרמולציה קוגניטיבית-התנהגותית, עוצמת סימפטומים, סיכון",
        guidance: "הערכה: אבחנה DSM-5 עדכנית, פרמולציה (triggers, automatic thoughts, core beliefs), עוצמת סימפטומים ביחס לסולמות, התקדמות ביחס ליעדים, הערכת סיכון, גורמי protective",
      },
      {
        key: "plan",
        label: "תוכנית טיפולית",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "התערבויות CBT/DBT, משימות בית, יעדי פגישה הבאה, הפניות, תדירות",
        guidance: "תוכנית: התערבויות שבוצעו (cognitive restructuring, exposure, mindfulness, behavioral activation), משימות בית ספציפיות, יעד לפגישה הבאה, הפניות לפסיכיאטר/שירותים אחרים, תדירות פגישות",
      },
    ],
  },
  // ── כירופרקטיקה ──────────────────────────────────────────────────────
  {
    id: "chiropractic",
    name: "כירופרקטיקה",
    description: "הערכה עמוד שדרה, מניפולציה, כאבי גב/צוואר, עצב כלוא, כאבי ראש",
    icon: "🔧",
    profession: "כירופרקטיקה",
    scale_label: "VAS כאב",
    scale_improvement_lower: true,
    systemContext: "קליניקה כירופרקטית. ציין בדיקות אורטופדיות-נוירולוגיות ספציפיות (SLR, Kemp, Spurling, Ortolani), רמת subluxation, וסוג ומיקום מניפולציה (HVLA, mobilization, drop). ציין ROM בדרגות, ממצאי ציר שדרה.",
    sections: [
      {
        key: "subjective",
        label: "דיווח סובייקטיבי",
        letter: "S",
        color: "bg-sky-500",
        ring: "focus-within:ring-sky-200",
        placeholder: "תלונות, מיקום וסוג כאב, מחמירים/משפרים, הקרנות, שינויים מהטיפול הקודם",
        guidance: "דיווח: תלונה עיקרית, מיקום ואופי הכאב (VAS/NRS), הקרנות (דרמטום), מחמירים ומשפרים (תנועה, ישיבה, שכיבה), שינויים נוירולוגיים (חוסר תחושה, עקצוץ, חולשה), שינויים מהטיפול הקודם",
      },
      {
        key: "objective",
        label: "בדיקה גופנית",
        letter: "O",
        color: "bg-emerald-500",
        ring: "focus-within:ring-emerald-200",
        placeholder: "יציבה, ROM, palpation, בדיקות אורטופדיות-נוירולוגיות, ממצאי עמוד שדרה",
        guidance: "ממצאים: יציבה ב-stance, ROM (בדרגות — פלקציה, אקסטנציה, לטרל פלקציה, רוטציה), palpation (PIPS, muscle guarding, trigger points), בדיקות אורטופדיות (SLR, Kemp, Spurling), רפלקסים, ממצאי subluxation complex",
      },
      {
        key: "assessment",
        label: "אבחנה כירופרקטית",
        letter: "A",
        color: "bg-amber-500",
        ring: "focus-within:ring-amber-200",
        placeholder: "אבחנה, רמת subluxation, התקדמות, פרוגנוזה, גורמים תורמים",
        guidance: "אבחנה: subluxation complex (מיקום, רמה), אבחנה אורטופדית/נוירולוגית, שלב (אקוטי/כרוני), התקדמות ביחס ליעדים, גורמים ארגונומיים/עמוסיים, פרוגנוזה",
      },
      {
        key: "plan",
        label: "תוכנית טיפול",
        letter: "P",
        color: "bg-violet-500",
        ring: "focus-within:ring-violet-200",
        placeholder: "מניפולציה שבוצעה, טכניקות, תרגילים, עצות ארגונומיה, תדירות",
        guidance: "טיפול: מניפולציה HVLA/mobilization (מיקום ספציפי, כיוון, תגובת המטופל), טכניקות נלוות (soft tissue, ultrasound, IFC), תרגילי חיזוק/מתיחה, עצות ארגונומיה ואורח חיים, תדירות וסה\"כ טיפולים מתוכנן",
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
        profession: s?.template_profession ?? "אחר",
        scale_label: s?.template_scale_label ?? "ציון מדד",
        scale_improvement_lower: s?.template_scale_improvement_lower ?? true,
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

  return `אתה עוזר קליני לאנשי מקצוע בתחום הבריאות בישראל. קיבלת תמלול של שיחת טיפול קליני.
הקליניקה עובדת בפורמט: ${template.name} (${template.profession}).
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
