// Server-only helper: wipe a (demo) clinic's data and regenerate a fresh,
// profession-appropriate sample dataset. Shared by the demo-seed API route and
// the super-admin clinic-creation route.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalTemplate } from "./clinic-templates";
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

const DOC_TITLES: { type: string; title: string }[] = [
  { type: "referral", title: "מכתב הפניה" },
  { type: "status_report", title: "דוח מצב טיפולי" },
  { type: "discharge_summary", title: "סיכום סיום טיפול" },
];

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
  await admin.from("treatments").delete().eq("clinic_id", clinicId);
  await admin.from("conversations").delete().eq("clinic_id", clinicId);
  await admin.from("patients").delete().eq("clinic_id", clinicId);

  let patients = 0, treatments = 0, measurements = 0;
  const patientIds: string[] = [];

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

  if (patientIds.length) {
    const docs = Array.from({ length: 3 }, (_, i) => {
      const d = DOC_TITLES[i % DOC_TITLES.length];
      return {
        clinic_id: clinicId,
        patient_id: patientIds[Math.floor(Math.random() * patientIds.length)],
        type: d.type,
        title: d.title,
        content: "",
        status: "draft",
        created_by: createdBy,
        ai_generated: false,
        created_at: new Date(Date.now() - (i + 1) * 5 * 864e5).toISOString(),
      };
    });
    await admin.from("documents").insert(docs);

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
