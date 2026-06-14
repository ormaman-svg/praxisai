// Demo dataset generator — produces profession- & demographic-appropriate
// sample patients, treatments, measurements, documents and appointments so that
// a demo clinic's data + analytics match its selected clinic type.
// Pure/server-safe: no next/headers, no DB access (the API route persists it).

import type { ClinicalTemplate } from "./clinic-templates";

/* ── name & reference pools ─────────────────────────────────────────── */

const PEDIATRIC_TEMPLATE_IDS = new Set(["pediatric_dev", "slp_pediatric", "ot_pediatric"]);

const LAST_NAMES = [
  "כהן", "לוי", "מזרחי", "פרץ", "ביטון", "דהן", "אברהם", "פרידמן",
  "שפירא", "אזולאי", "חדד", "גבאי", "אבני", "ברק", "סבן", "מלכה",
];

const ADULT_FIRST_M = ["אבי", "משה", "יוסי", "דוד", "אייל", "רון", "גיא", "עומר", "ניר", "טל"];
const ADULT_FIRST_F = ["מיכל", "רונית", "ענת", "דנה", "קרן", "ליאת", "נטע", "הדס", "אורנה", "שירן"];
const KID_FIRST_M = ["איתי", "יונתן", "נועם", "דניאל", "אורי", "איתמר", "אריאל", "עידו", "רוני", "אלון"];
const KID_FIRST_F = ["מאיה", "נועה", "שירה", "יעל", "טליה", "אגם", "ליה", "הילה", "רומי", "אמה"];

const KUPOT = ["כללית", "מכבי", "מאוחדת", "לאומית", "פרטי"];

const REFERRAL_SOURCES = ["רופא משפחה", "אורתופד", "נוירולוג", "הפניה עצמית", "ביטוח לאומי", "רופא ילדים"];

/* Diagnoses keyed by template id first, then profession, then a generic fallback. */
const DIAGNOSES_BY_TEMPLATE: Record<string, string[]> = {
  ortho_outpatient: ["כאב גב תחתון כרוני", "קרע מניסקוס", "שיקום לאחר ניתוח ACL", "תסמונת צביטה בכתף", "נקע קרסול", "אפיקונדיליטיס לטרלי", "אוסטאוארתריטיס ברך", "פריצת דיסק מותני"],
  neuro_outpatient: ["שבץ מוחי — המיפרזיס", "טרשת נפוצה", "מחלת פרקינסון", "פגיעת חוט שדרה חלקית", "נוירופתיה היקפית", "פגיעת ראש טראומטית"],
  pediatric_dev: ["עיכוב התפתחותי", "שיתוק מוחין (CP)", "היפוטוניה", "עיכוב בהליכה עצמאית", "טורטיקוליס תינוקי", "הליכה על קצות אצבעות"],
  rehabilitation: ["שיקום לאחר החלפת מפרק ירך", "שיקום לאחר שבר בצוואר הירך", "דה-קונדישנינג לאחר אשפוז ממושך", "שיקום לאחר קטיעה"],
  inpatient_acute: ["מצב לאחר ניתוח לבבי", "אי-ספיקה נשימתית", "גיוס מוקדם לאחר ניתוח בטני", "מצב לאחר שבץ חריף"],
  pelvic_floor: ["אי-נקיטת שתן במאמץ", "כאב אגן כרוני", "שיקום רצפת אגן לאחר לידה", "צניחת איברי אגן"],
  vestibular: ["סחרחורת BPPV", "נוירוניטיס וסטיבולרי", "מחלת מנייר", "חוסר יציבות לאחר נפילה"],
  slp_adult: ["אפזיה לאחר שבץ", "דיספגיה (קושי בבליעה)", "דיסארתריה", "גמגום במבוגרים", "צרידות כרונית / הפרעת קול"],
  slp_pediatric: ["עיכוב שפתי", "הפרעת היגוי (ארטיקולציה)", "גמגום ילדות", "עיכוב בהתפתחות הדיבור", "קשיי האכלה ובליעה"],
  ot_adult: ["שיקום יד לאחר שבר", "אימון ADL לאחר שבץ", "פגיעה בעצב היקפי", "דלקת מפרקים שגרונית", "תסמונת התעלה הקרפלית"],
  ot_pediatric: ["קשיי ויסות חושי", "עיכוב במוטוריקה עדינה", "קשיים גרפומוטוריים", "אינטגרציה סנסורית", "קשיי קואורדינציה (DCD)"],
  dietetics: ["סוכרת סוג 2", "השמנה", "מחלת כליות כרונית", "כולסטרול גבוה", "תסמונת מעי רגיז (IBS)", "אנמיה מחוסר ברזל"],
  nursing_community: ["טיפול בפצע לחץ דרגה 2", "מעקב סוכרת בקהילה", "החלמה לאחר אירוע לבבי", "ניהול ריבוי תרופות", "טיפול בפצע סוכרתי"],
  psychology_clinical: ["הפרעת חרדה כללית", "דיכאון מאז'ורי", "הפרעת דחק פוסט-טראומטית (PTSD)", "הפרעת הסתגלות", "התקפי פאניקה"],
  chiropractic: ["כאב גב תחתון", "כאב צוואר מכני", "מיגרנות / כאבי ראש צוואריים", "כאב סיאטי", "הגבלת תנועה בגב עליון"],
};

const DIAGNOSES_FALLBACK = ["הערכה קלינית כללית", "מעקב טיפולי", "שיקום תפקודי"];

/* ROM joints by physiotherapy diagnosis flavor (for the analytics ROM chart). */
const ROM_TARGETS: { joint: string; movement: string; start: number; goal: number }[] = [
  { joint: "כתף ימין", movement: "אבדוקציה", start: 90, goal: 165 },
  { joint: "ברך שמאל", movement: "כפיפה", start: 80, goal: 135 },
  { joint: "מותן", movement: "כפיפה קדמית", start: 40, goal: 85 },
  { joint: "קרסול ימין", movement: "דורסיפלקציה", start: 5, goal: 20 },
];

const TREATMENT_TYPES_FLOW = ["initial_eval", "follow_up", "follow_up", "follow_up", "follow_up", "follow_up", "discharge"];

/* ── small RNG helpers ──────────────────────────────────────────────── */
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ── types ──────────────────────────────────────────────────────────── */

export type DemoPatient = {
  first_name: string; last_name: string; dob: string; phone: string;
  kupah: string; diagnosis: string; referral_source: string; status: string;
};
export type DemoTreatmentNote = { template_id: string; template_name: string; sections: { key: string; label: string; letter: string; content: string }[] };
export type DemoTreatment = {
  treated_at: string; type: string; vas: number; template_id: string;
  note: DemoTreatmentNote;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null;
};
export type DemoMeasurement = { kind: string; joint: string; movement: string; value: number; unit: string; recorded_at: string };
export type DemoUnit = { patient: DemoPatient; treatments: DemoTreatment[]; measurements: DemoMeasurement[] };

/* ── content builders ───────────────────────────────────────────────── */

function progressPhrase(i: number, total: number): string {
  const r = total <= 1 ? 1 : i / (total - 1);
  if (r < 0.25) return "שיפור קל בתסמינים";
  if (r < 0.6) return "שיפור ניכר, עלייה ביכולת התפקודית";
  if (r < 0.9) return "שיפור משמעותי, קרוב ליעדי הטיפול";
  return "עמידה ביעדים, מתקרב לסיום טיפול";
}

function sectionContent(key: string, label: string, dx: string, i: number, total: number, pediatric: boolean): string {
  const who = pediatric ? "ההורים מדווחים" : "המטופל/ת מדווח/ת";
  const k = key.toLowerCase();
  if (/(subjective|history|background|complaint|anamnesis|report)/.test(k))
    return `${who} על ${dx}. ${progressPhrase(i, total)} מאז הביקור הקודם.`;
  if (/(objective|exam|finding|measure|assessment_find|status)/.test(k))
    return `בבדיקה: ממצאים תואמים ל${dx}; ${progressPhrase(i, total)}.`;
  if (/(assessment|impression|diagnos|analysis)/.test(k))
    return `התרשמות קלינית: ${dx}. תגובה טובה לטיפול, ${progressPhrase(i, total)}.`;
  if (/(plan|goal|intervention|treatment|recommend|next)/.test(k))
    return `תוכנית: המשך פרוטוקול טיפול, תרגול ביתי והדרכה. יעד לביקור הבא בהתאם להתקדמות.`;
  return `${label}: עודכן בהתאם ל${dx} (מפגש ${i + 1}).`;
}

function buildTreatments(template: ClinicalTemplate, dx: string, pediatric: boolean): DemoTreatment[] {
  const total = rint(4, 7);
  const lowerIsBetter = template.scale_improvement_lower !== false; // default: lower = improvement (pain)
  const start = lowerIsBetter ? rint(7, 9) : rint(2, 4);
  const end = lowerIsBetter ? rint(1, 3) : rint(8, 9);

  const out: DemoTreatment[] = [];
  for (let i = 0; i < total; i++) {
    // spread sessions over the last ~5 months, most recent first → chronological
    const daysAgo = Math.round((5 * 30) * (1 - i / total)) + rint(-3, 3);
    const treated = new Date(Date.now() - Math.max(daysAgo, 0) * 864e5);
    const t = total <= 1 ? 1 : i / (total - 1);
    const vasRaw = start + (end - start) * t + (Math.random() * 1.2 - 0.6);
    const vas = Math.max(0, Math.min(10, Math.round(vasRaw)));

    const sections = template.sections.map((s) => ({
      key: s.key, label: s.label, letter: s.letter,
      content: sectionContent(s.key, s.label, dx, i, total, pediatric),
    }));
    const byKey = (k: string) => sections.find((s) => s.key === k)?.content ?? null;

    out.push({
      treated_at: treated.toISOString(),
      type: TREATMENT_TYPES_FLOW[Math.min(i, TREATMENT_TYPES_FLOW.length - 1)],
      vas,
      template_id: template.id,
      note: { template_id: template.id, template_name: template.name, sections },
      subjective: byKey("subjective"),
      objective: byKey("objective"),
      assessment: byKey("assessment"),
      plan: byKey("plan"),
    });
  }
  return out;
}

function buildMeasurements(treatments: DemoTreatment[]): DemoMeasurement[] {
  // ROM progression tied to treatment dates (physiotherapy only).
  const target = pick(ROM_TARGETS);
  const total = treatments.length;
  return treatments.map((t, i) => {
    const r = total <= 1 ? 1 : i / (total - 1);
    const value = Math.round(target.start + (target.goal - target.start) * r + rint(-4, 4));
    return { kind: "ROM", joint: target.joint, movement: target.movement, value, unit: "deg", recorded_at: t.treated_at };
  });
}

/* ── public API ─────────────────────────────────────────────────────── */

/** Build a full demo dataset appropriate for the clinic's template/profession. */
export function buildDemoDataset(template: ClinicalTemplate, count = 10): DemoUnit[] {
  const pediatric = PEDIATRIC_TEMPLATE_IDS.has(template.id);
  const diagnoses = DIAGNOSES_BY_TEMPLATE[template.id] ?? DIAGNOSES_FALLBACK;
  const isPhysio = template.profession === "פיזיותרפיה";

  const units: DemoUnit[] = [];
  for (let n = 0; n < count; n++) {
    const female = Math.random() < 0.5;
    const first = pediatric
      ? pick(female ? KID_FIRST_F : KID_FIRST_M)
      : pick(female ? ADULT_FIRST_F : ADULT_FIRST_M);
    const last = pick(LAST_NAMES);
    const dx = pick(diagnoses);

    // age-appropriate DOB
    const age = pediatric ? rint(2, 12) : rint(20, 82);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - age);
    dob.setMonth(rint(0, 11), rint(1, 28));

    const patient: DemoPatient = {
      first_name: first,
      last_name: last,
      dob: dob.toISOString().slice(0, 10),
      phone: `05${rint(0, 8)}-${rint(1000000, 9999999)}`,
      kupah: pick(KUPOT),
      diagnosis: dx,
      referral_source: pick(REFERRAL_SOURCES),
      status: Math.random() < 0.85 ? "active" : "discharged",
    };

    const treatments = buildTreatments(template, dx, pediatric);
    const measurements = isPhysio ? buildMeasurements(treatments) : [];
    units.push({ patient, treatments, measurements });
  }
  return units;
}
