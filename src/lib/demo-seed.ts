// Server-only helper: wipe a (demo) clinic's data and regenerate a fresh,
// profession-appropriate sample dataset. Shared by the demo-seed API route and
// the super-admin clinic-creation route.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalTemplate } from "./clinic-templates";
import { buildDemoDataset } from "./demo-data";

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

  return { patients, treatments, measurements };
}
