// Server-only helper: wipe a (demo) clinic's data and regenerate a fresh,
// profession-appropriate sample dataset. Shared by the demo-seed API route and
// the super-admin clinic-creation route.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalTemplate } from "./clinic-templates";
import { getHomeProgramConfig } from "./clinic-templates";
import { buildDemoDataset } from "./demo-data";

/* ── Demo inbox conversations ───────────────────────────────────────── */

type DemoMsg = { direction: "inbound" | "outbound"; body: string; minutesAgo: number };
type DemoConv = { status: "bot" | "human"; messages: DemoMsg[] };

// Conversations keyed by template category (broad match)
const DEMO_CONVERSATIONS: Record<string, DemoConv[]> = {
  physio: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום אורי, תזכורת לטיפול מחר בשעה 10:00 עם שרה. אישור/ביטול?", minutesAgo: 60 },
        { direction: "inbound",  body: "אישור", minutesAgo: 55 },
        { direction: "outbound", body: "תודה! הפגישה מאושרת. נתראה מחר 😊", minutesAgo: 55 },
      ],
    },
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום מיכל, האם ביצעת את תרגילי הבית? שלחי: כן/לא + רמת כאב 0-10", minutesAgo: 120 },
        { direction: "inbound",  body: "כן, 4", minutesAgo: 110 },
        { direction: "outbound", body: "מעולה! תרגילי הבית נרשמו (כאב: 4/10). כל הכבוד! 💪", minutesAgo: 110 },
        { direction: "inbound",  body: "תודה, יש שאלה — האם אפשר לעשות את תרגיל הכתף גם בבריכה?", minutesAgo: 90 },
        { direction: "outbound", body: "שאלה מצוינת! לשאלות קליניות מפנה אתכם לצוות הקליניקה שיחזור אליכם בהקדם.", minutesAgo: 90 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "outbound", body: "שלום דוד, חיוב 350 ₪ עבור טיפול. לתשלום: https://meshulam.co.il/demo", minutesAgo: 200 },
        { direction: "inbound",  body: "שלום, שילמתי אבל לא קיבלתי אישור", minutesAgo: 150 },
        { direction: "outbound", body: "אנחנו בודקים ונחזור אליך בהקדם. תודה על הסבלנות!", minutesAgo: 148 },
        { direction: "inbound",  body: "בסדר תודה", minutesAgo: 100 },
      ],
    },
  ],
  neuro: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום חנה, תזכורת לביקור מחר בשעה 09:00. אישור?", minutesAgo: 90 },
        { direction: "inbound",  body: "כן מאשרת", minutesAgo: 85 },
        { direction: "outbound", body: "תודה! הפגישה מאושרת. נתראה מחר.", minutesAgo: 84 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "outbound", body: "שלום גיא, האם ביצעת את תרגילי הבית השבועיים?", minutesAgo: 300 },
        { direction: "inbound",  body: "ביצעתי חלק, אבל יש לי כאב ראש חזק שלא עבר כבר 3 ימים", minutesAgo: 240 },
        { direction: "outbound", body: "מעביר אותך לצוות הרפואי — יחזרו אליך בהקדם.", minutesAgo: 239 },
        { direction: "inbound",  body: "תודה", minutesAgo: 200 },
      ],
    },
  ],
  pediatric: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום! תזכורת לטיפול של נועם מחר בשעה 11:00. אישור/ביטול?", minutesAgo: 45 },
        { direction: "inbound",  body: "מאשרים", minutesAgo: 40 },
        { direction: "outbound", body: "מצוין! הפגישה מאושרת. נתראה מחר 😊", minutesAgo: 39 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "outbound", body: "שלום, האם איתי ביצע את תרגילי הנשימה הביתיים?", minutesAgo: 180 },
        { direction: "inbound",  body: "ביצע 4 מתוך 5 ימים. אגב רציתי לשאול אם אפשר לדלג שיעור בגלל חופש", minutesAgo: 120 },
        { direction: "outbound", body: "בכיף! אנחנו מעבירים אתכם לצוות לתיאום. יחזרו אליכם בהקדם.", minutesAgo: 119 },
        { direction: "inbound",  body: "תודה רבה", minutesAgo: 80 },
      ],
    },
  ],
  pelvic: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום רונית, תזכורת לביקור מחר בשעה 10:30. אישור?", minutesAgo: 70 },
        { direction: "inbound",  body: "כן, מאשרת", minutesAgo: 65 },
        { direction: "outbound", body: "תודה! הביקור מאושר.", minutesAgo: 64 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "outbound", body: "שלום ענת, האם ביצעת את תרגילי קרסול שוב?", minutesAgo: 250 },
        { direction: "inbound",  body: "כן, אבל יש לי כאב שנראה לי שונה מהרגיל", minutesAgo: 220 },
        { direction: "outbound", body: "מעבירה לצוות — יצרו קשר בהקדם.", minutesAgo: 219 },
        { direction: "inbound",  body: "בסדר תודה", minutesAgo: 180 },
      ],
    },
  ],
  psych: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום אייל, תזכורת לפגישה מחר בשעה 17:00. אישור?", minutesAgo: 30 },
        { direction: "inbound",  body: "אישור", minutesAgo: 25 },
        { direction: "outbound", body: "תודה! נתראה מחר.", minutesAgo: 24 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "inbound",  body: "שלום, אני זקוקה לדחות את הפגישה ביום שני", minutesAgo: 400 },
        { direction: "outbound", body: "בקשת הדחייה נרשמה — צוות הקליניקה ייצור קשר לתיאום. תודה!", minutesAgo: 399 },
        { direction: "inbound",  body: "תודה", minutesAgo: 350 },
      ],
    },
  ],
  default: [
    {
      status: "bot",
      messages: [
        { direction: "outbound", body: "שלום! תזכורת לביקור מחר בשעה 10:00. אישור/ביטול?", minutesAgo: 60 },
        { direction: "inbound",  body: "מאשר", minutesAgo: 55 },
        { direction: "outbound", body: "הביקור מאושר. נתראה מחר!", minutesAgo: 54 },
      ],
    },
    {
      status: "human",
      messages: [
        { direction: "outbound", body: "שלום, חיוב 300 ₪ ממתין לתשלום. לפרטים פנו לקליניקה.", minutesAgo: 200 },
        { direction: "inbound",  body: "מתי אפשר לשלם?", minutesAgo: 150 },
        { direction: "outbound", body: "מעביר לצוות שיחזור אליך בהקדם.", minutesAgo: 149 },
      ],
    },
  ],
};

function pickConvTemplate(templateId: string): DemoConv[] {
  if (/(ortho|vestibular|chiro|rehab|inpatient)/.test(templateId)) return DEMO_CONVERSATIONS.physio;
  if (/(neuro|slp_adult)/.test(templateId)) return DEMO_CONVERSATIONS.neuro;
  if (/(pediatric|slp_ped|ot_ped)/.test(templateId)) return DEMO_CONVERSATIONS.pediatric;
  if (/pelvic/.test(templateId)) return DEMO_CONVERSATIONS.pelvic;
  if (/(psych|psychology)/.test(templateId)) return DEMO_CONVERSATIONS.psych;
  if (/(ot_adult|dietetic|nursing)/.test(templateId)) return DEMO_CONVERSATIONS.default;
  return DEMO_CONVERSATIONS.physio;
}

/* ── Demo home-program (HEP) exercises ──────────────────────────────── */

type DemoExercise = {
  name: string;
  sets: number | null;
  reps: number | null;
  hold_sec: number | null;
  frequency: string;       // 'daily' | '2x_daily' | 'alternate_days'
  description: string;
};
type DemoProgram = { title: string; instructions: string; items: DemoExercise[] };

const DEMO_PROGRAMS: Record<string, DemoProgram> = {
  physio: {
    title: "תוכנית תרגול לבית — שיקום אורתופדי",
    instructions: "לבצע מדי יום. להפסיק במקרה של כאב חד ולעדכן את המטפל.",
    items: [
      { name: "מתיחת שריר ארבע ראשי", sets: 3, reps: 10, hold_sec: 20, frequency: "daily", description: "בעמידה, אחזו בקרסול ומשכו את העקב לעבר הישבן עד תחושת מתיחה קלה בקדמת הירך." },
      { name: "גשר אגן לחיזוק", sets: 3, reps: 12, hold_sec: 5, frequency: "daily", description: "שכיבה על הגב וברכיים כפופות, הרימו את האגן תוך כיווץ שרירי הישבן והחזיקו." },
      { name: "יציבות על רגל אחת", sets: 3, reps: 1, hold_sec: 30, frequency: "daily", description: "עמדו על רגל אחת ליד משטח יציב לתמיכה. שמרו על שיווי משקל." },
      { name: "מתיחת שרירי שוק", sets: 2, reps: 10, hold_sec: 20, frequency: "daily", description: "בעמידה מול קיר, רגל אחת מאחור עם עקב על הרצפה, רכנו קדימה." },
    ],
  },
  neuro: {
    title: "תוכנית תרגול תפקודי לבית",
    instructions: "בצעו בנוכחות מלווה לבטיחות. תדירות יומית מומלצת.",
    items: [
      { name: "העברת משקל מצד לצד", sets: 2, reps: 15, hold_sec: 3, frequency: "daily", description: "בעמידה יציבה, העבירו משקל מרגל לרגל באיטיות תוך שמירה על יציבה." },
      { name: "קימה מישיבה לעמידה", sets: 3, reps: 8, hold_sec: 0, frequency: "daily", description: "מכיסא יציב עם משענות, קומו לעמידה ושבו חזרה בשליטה." },
      { name: "תרגול אחיזה ושחרור", sets: 3, reps: 12, hold_sec: 2, frequency: "2x_daily", description: "אחזו ושחררו כדור גומי רך לחיזוק כף היד והאצבעות." },
      { name: "תרגול שיווי משקל ליד משטח", sets: 2, reps: 1, hold_sec: 30, frequency: "daily", description: "עמדו ליד משטח יציב ותרגלו שמירת יציבה עם רגליים צמודות." },
    ],
  },
  pediatric: {
    title: "תוכנית משחק ותרגול לבית",
    instructions: "לשלב במשחק יומיומי. לעודד ולתגמל את הילד/ה.",
    items: [
      { name: "זחילה במנהרת בד", sets: 2, reps: 5, hold_sec: 0, frequency: "daily", description: "עודדו את הילד/ה לזחול דרך מנהרה לחיזוק חגורת הכתפיים." },
      { name: "קפיצות על טרמפולינה קטנה", sets: 2, reps: 15, hold_sec: 0, frequency: "daily", description: "קפיצות מבוקרות לשיפור שיווי משקל וויסות חושי." },
      { name: "השחלת חרוזים", sets: 1, reps: 10, hold_sec: 0, frequency: "daily", description: "השחלת חרוזים גדולים על חוט לחיזוק מוטוריקה עדינה." },
      { name: "משחק כדור — תפיסה וזריקה", sets: 2, reps: 10, hold_sec: 0, frequency: "daily", description: "תפיסה וזריקה של כדור רך לשיפור קואורדינציה עין-יד." },
    ],
  },
  pelvic: {
    title: "תוכנית תרגול רצפת אגן לבית",
    instructions: "לבצע בשכיבה או ישיבה נוחה. הקפידו על נשימה רגועה.",
    items: [
      { name: "כיווצי רצפת אגן (קגל) איטיים", sets: 3, reps: 10, hold_sec: 5, frequency: "daily", description: "כווצו את שרירי רצפת האגן כאילו עוצרים מתן שתן, החזיקו 5 שניות ושחררו." },
      { name: "כיווצים מהירים", sets: 3, reps: 10, hold_sec: 1, frequency: "daily", description: "כיווץ ושחרור מהירים של רצפת האגן לחיזוק תגובה מהירה." },
      { name: "נשימה סרעפתית", sets: 2, reps: 8, hold_sec: 4, frequency: "2x_daily", description: "נשימה עמוקה לבטן תוך הרפיית רצפת האגן בשאיפה." },
    ],
  },
  ot: {
    title: "תוכנית תרגול תפקודי לבית",
    instructions: "לשלב בפעילויות היומיום. לעדכן את המטפל על קשיים.",
    items: [
      { name: "תרגול אחיזת עיפרון וכתיבה", sets: 2, reps: 10, hold_sec: 0, frequency: "daily", description: "תרגול כתיבה ושרטוט קווים לחיזוק אחיזה ושליטה מוטורית." },
      { name: "מיון והברגת אומים", sets: 2, reps: 10, hold_sec: 0, frequency: "daily", description: "הברגה ופירוק של אומים וברגים לחיזוק מוטוריקה עדינה." },
      { name: "תרגול לבישה עצמאית", sets: 1, reps: 1, hold_sec: 0, frequency: "daily", description: "תרגול לבישת חולצה וכפתורים באופן עצמאי." },
    ],
  },
  slp: {
    title: "תוכנית תרגול תקשורת לבית",
    instructions: "לתרגל בסביבה שקטה, מספר דקות מדי יום.",
    items: [
      { name: "תרגול הפקת הצליל המטרה", sets: null, reps: null, hold_sec: null, frequency: "daily", description: "תרגול הצליל ברמת ההברה והמילה מול מראה, 5–10 דקות." },
      { name: "תרגילי נשיפה לחיזוק שרירי הפה", sets: null, reps: null, hold_sec: null, frequency: "daily", description: "נשיפה דרך קשית לתוך מים או ניפוח בלון לחיזוק שרירי הפה." },
      { name: "קריאת מילים בקול", sets: null, reps: null, hold_sec: null, frequency: "daily", description: "קריאת רשימת מילים בקול רם בקצב איטי וברור." },
    ],
  },
  psych: {
    title: "משימות טיפוליות לבית",
    instructions: "לבצע בין הפגישות. נדבר על כך בפגישה הבאה.",
    items: [
      { name: "יומן מחשבות אוטומטיות", sets: null, reps: null, hold_sec: null, frequency: "daily", description: "רשמו מצב מעורר, המחשבה האוטומטית, הרגש ועוצמתו (0–100)." },
      { name: "תרגול נשימה והרפיה", sets: null, reps: null, hold_sec: null, frequency: "2x_daily", description: "תרגול נשימה סרעפתית 5 דקות להפחתת מתח." },
      { name: "הפעלה התנהגותית — פעילות מהנה", sets: null, reps: null, hold_sec: null, frequency: "daily", description: "תכננו ובצעו פעילות מהנה אחת ביום ותעדו את ההשפעה על מצב הרוח." },
    ],
  },
  default: {
    title: "תוכנית תרגול לבית",
    instructions: "לבצע בהתאם להנחיות המטפל.",
    items: [
      { name: "תרגיל לחיזוק כללי", sets: 3, reps: 10, hold_sec: 5, frequency: "daily", description: "תרגיל חיזוק בסיסי בהתאם להמלצת המטפל." },
      { name: "תרגיל מתיחה והרפיה", sets: 2, reps: 8, hold_sec: 15, frequency: "daily", description: "מתיחה עדינה לשמירה על טווחי תנועה." },
    ],
  },
};

function pickProgram(templateId: string): DemoProgram {
  if (/pelvic/.test(templateId)) return DEMO_PROGRAMS.pelvic;
  if (/(ortho|vestibular|chiro|rehab|inpatient)/.test(templateId)) return DEMO_PROGRAMS.physio;
  if (/neuro/.test(templateId)) return DEMO_PROGRAMS.neuro;
  if (/(pediatric|ot_pediatric)/.test(templateId)) return DEMO_PROGRAMS.pediatric;
  if (/slp/.test(templateId)) return DEMO_PROGRAMS.slp;
  if (/ot_adult/.test(templateId)) return DEMO_PROGRAMS.ot;
  if (/(psych|psychology)/.test(templateId)) return DEMO_PROGRAMS.psych;
  return DEMO_PROGRAMS.default;
}

/* ── Demo documents (with realistic content) ────────────────────────── */

const DOC_TITLES: { type: string; title: string }[] = [
  { type: "referral", title: "מכתב הפניה" },
  { type: "status_report", title: "דו״ח התקדמות טיפולי" },
  { type: "discharge_summary", title: "סיכום סיום טיפול" },
];

function buildDocContent(type: string, patientName: string, diagnosis: string, professionName: string): string {
  const today = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  if (type === "referral") {
    return `לכבוד הרופא/ה המטפל/ת,\n\nהנדון: ${patientName}\nתאריך: ${today}\n\nמטופל/ת בטיפולנו ב${professionName} עקב ${diagnosis}. בבדיקה נמצאו ממצאים התואמים לאבחנה. מומלץ המשך בירור והערכה רפואית בהתאם.\n\nאשמח לעמוד לרשותכם בכל שאלה.\nבברכה,\nצוות הקליניקה`;
  }
  if (type === "status_report") {
    return `דו״ח התקדמות טיפולי\n\nשם המטופל/ת: ${patientName}\nתאריך: ${today}\nאבחנה: ${diagnosis}\n\nהמטופל/ת נמצא/ת בתהליך טיפול ב${professionName}. נצפתה התקדמות טובה ביחס ליעדי הטיפול, עם שיפור ביכולת התפקודית ובתסמינים. מומלץ המשך תוכנית הטיפול והתרגול הביתי.\n\nבברכה,\nצוות הקליניקה`;
  }
  return `סיכום סיום טיפול\n\nשם המטופל/ת: ${patientName}\nתאריך: ${today}\nאבחנה: ${diagnosis}\n\nהמטופל/ת סיים/ה סדרת טיפולים ב${professionName}. הושגו יעדי הטיפול העיקריים עם שיפור משמעותי במצב התפקודי. ניתנו המלצות לתרגול ושמירה עצמית בבית. מומלץ מעקב בהתאם לצורך.\n\nבברכה,\nצוות הקליניקה`;
}

const INVOICE_DESCRIPTIONS = ["טיפול", "סדרת טיפולים", "הערכה ראשונית", "טיפול המשך"];

export type DemoSeedResult = { patients: number; treatments: number; measurements: number };

export async function seedDemoClinic(
  admin: SupabaseClient,
  clinicId: string,
  template: ClinicalTemplate,
  opts: { therapistIds: string[]; createdBy: string | null },
): Promise<DemoSeedResult> {
  const { therapistIds, createdBy } = opts;
  const someTherapist = () =>
    therapistIds.length ? therapistIds[Math.floor(Math.random() * therapistIds.length)] : null;

  const dataset = buildDemoDataset(template);

  // Wipe existing clinic data (children first; patients cascade the rest).
  await admin.from("documents").delete().eq("clinic_id", clinicId);
  await admin.from("appointments").delete().eq("clinic_id", clinicId);
  await admin.from("measurements").delete().eq("clinic_id", clinicId);
  await admin.from("exercise_programs").delete().eq("clinic_id", clinicId);
  await admin.from("patient_invoices").delete().eq("clinic_id", clinicId);
  await admin.from("treatments").delete().eq("clinic_id", clinicId);
  await admin.from("conversations").delete().eq("clinic_id", clinicId);
  await admin.from("patients").delete().eq("clinic_id", clinicId);

  let patients = 0, treatments = 0, measurements = 0;
  const patientIds: string[] = [];
  // Per-patient info collected during seeding, reused for HEP / invoices / docs.
  const seeded: {
    id: string; firstName: string; lastName: string; diagnosis: string;
    latestTreatmentId: string | null;
  }[] = [];

  for (const unit of dataset) {
    const { data: p, error: pErr } = await admin.from("patients").insert({
      clinic_id: clinicId,
      first_name: unit.patient.first_name,
      last_name: unit.patient.last_name,
      dob: unit.patient.dob,
      phone: unit.patient.phone,
      kupah: unit.patient.kupah,
      diagnosis: unit.patient.diagnosis,
      referral_source: unit.patient.referral_source,
      status: unit.patient.status,
    }).select("id").single();
    if (pErr || !p) continue;
    patients++;
    patientIds.push(p.id);

    const therapist = someTherapist();
    const { data: trows } = await admin.from("treatments").insert(
      unit.treatments.map((t) => ({
        clinic_id: clinicId,
        patient_id: p.id,
        therapist_id: therapist,
        treated_at: t.treated_at,
        type: t.type,
        vas: t.vas,
        note: t.note,
        template_id: t.template_id,
        subjective: t.subjective,
        objective: t.objective,
        assessment: t.assessment,
        plan: t.plan,
      })),
    ).select("id, treated_at");
    treatments += trows?.length ?? 0;

    const latestTreatmentId = trows?.length
      ? [...trows].sort((a, b) => +new Date(b.treated_at) - +new Date(a.treated_at))[0].id as string
      : null;
    seeded.push({
      id: p.id,
      firstName: unit.patient.first_name,
      lastName: unit.patient.last_name,
      diagnosis: unit.patient.diagnosis,
      latestTreatmentId,
    });

    if (unit.measurements.length && trows?.length) {
      const idByDate = new Map(trows.map((r) => [r.treated_at as string, r.id as string]));
      const { data: mrows } = await admin.from("measurements").insert(
        unit.measurements.map((m, i) => ({
          clinic_id: clinicId,
          patient_id: p.id,
          treatment_id: idByDate.get(unit.treatments[i]?.treated_at) ?? null,
          kind: m.kind,
          joint: m.joint,
          movement: m.movement,
          value: m.value,
          unit: m.unit,
          recorded_at: m.recorded_at,
        })),
      ).select("id");
      measurements += mrows?.length ?? 0;
    }
  }

  // ── Per-patient documents (with realistic content) ──────────────────
  if (seeded.length) {
    const docs = seeded.map((s, i) => {
      const d = DOC_TITLES[i % DOC_TITLES.length];
      return {
        clinic_id: clinicId,
        patient_id: s.id,
        type: d.type,
        title: d.title,
        content: buildDocContent(d.type, `${s.firstName} ${s.lastName}`, s.diagnosis, template.profession),
        // Mix of finalized and AI-drafted documents for a realistic inbox.
        status: i % 3 === 0 ? "final" : "draft",
        created_by: createdBy,
        ai_generated: i % 2 === 0,
        created_at: new Date(Date.now() - (i + 1) * 3 * 864e5).toISOString(),
      };
    });
    await admin.from("documents").insert(docs);
  }

  // ── Per-patient home-program (HEP) — only where clinically relevant ──
  const homeProgram = getHomeProgramConfig(template.profession);
  if (homeProgram && seeded.length) {
    const tpl = pickProgram(template.id);
    for (const s of seeded) {
      const { data: prog } = await admin.from("exercise_programs").insert({
        clinic_id: clinicId,
        patient_id: s.id,
        treatment_id: s.latestTreatmentId,
        title: tpl.title,
        instructions: tpl.instructions,
        active: true,
        created_by: createdBy,
      }).select("id").single();
      if (!prog?.id) continue;
      await admin.from("program_items").insert(
        tpl.items.map((it, idx) => ({
          program_id: prog.id,
          name: it.name,
          sets: homeProgram.showSetsReps ? it.sets : null,
          reps: homeProgram.showSetsReps ? it.reps : null,
          hold_sec: homeProgram.showSetsReps ? it.hold_sec : null,
          frequency: it.frequency,
          description: it.description,
          sort_order: idx,
        })),
      );
    }
  }

  // ── Per-patient invoices (mix of paid / pending) ────────────────────
  if (seeded.length) {
    const invoices = seeded.map((s, i) => {
      const paid = i % 3 !== 0; // ~2/3 paid
      const amount = 150 + Math.floor(Math.random() * 7) * 50; // 150–450 ₪
      const desc = `${INVOICE_DESCRIPTIONS[i % INVOICE_DESCRIPTIONS.length]} ${template.profession}`;
      const createdAt = new Date(Date.now() - (i + 1) * 4 * 864e5);
      return {
        clinic_id: clinicId,
        patient_id: s.id,
        amount_ils: amount,
        description: desc,
        status: paid ? "paid" : "pending",
        stripe_payment_link: paid ? null : "https://meshulam.co.il/demo",
        paid_at: paid ? createdAt.toISOString() : null,
        created_by: createdBy,
        created_at: createdAt.toISOString(),
      };
    });
    await admin.from("patient_invoices").insert(invoices);
  }

  if (patientIds.length) {
    const appts = Array.from({ length: 6 }, () => {
      const start = new Date();
      start.setDate(start.getDate() + Math.floor(Math.random() * 12) + 1);
      start.setHours(8 + Math.floor(Math.random() * 9), [0, 30][Math.floor(Math.random() * 2)], 0, 0);
      const end = new Date(start.getTime() + 45 * 60000);
      return {
        clinic_id: clinicId,
        patient_id: patientIds[Math.floor(Math.random() * patientIds.length)],
        therapist_id: someTherapist(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "scheduled",
        created_by: createdBy,
      };
    });
    await admin.from("appointments").insert(appts);
  }

  // Seed demo inbox conversations
  if (patientIds.length) {
    const convTemplates = pickConvTemplate(template.id);
    for (let ci = 0; ci < convTemplates.length; ci++) {
      const convTpl = convTemplates[ci];
      const patientId = patientIds[ci % patientIds.length];

      // Look up the patient's phone for wa_contact
      const { data: pat } = await admin
        .from("patients")
        .select("phone, first_name, last_name")
        .eq("id", patientId)
        .single();

      const lastMsg = convTpl.messages.at(-1);
      const lastMsgAt = lastMsg
        ? new Date(Date.now() - lastMsg.minutesAgo * 60_000).toISOString()
        : new Date().toISOString();

      const { data: conv } = await admin.from("conversations").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        channel: "whatsapp",
        wa_contact: pat?.phone ?? null,
        status: convTpl.status,
        last_message_at: lastMsgAt,
      }).select("id").single();

      if (!conv?.id) continue;

      await admin.from("messages").insert(
        convTpl.messages.map((m) => ({
          conversation_id: conv.id,
          direction: m.direction,
          body: m.body,
          status: m.direction === "outbound" ? "sent" : "delivered",
          sent_at: new Date(Date.now() - m.minutesAgo * 60_000).toISOString(),
        }))
      );
    }
  }

  return { patients, treatments, measurements };
}
