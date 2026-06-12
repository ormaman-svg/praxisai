import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { TREATMENT_TYPE_HE } from "@/lib/types";

const SOAP_LEGACY = new Set(["subjective", "objective", "assessment", "plan"]);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { patientId, type, vas, sections } = body as {
    patientId: string;
    type?: string;
    vas?: number | null;
    sections?: Record<string, string>;
  };

  if (!patientId) return Response.json({ error: "Patient required" }, { status: 400 });

  if (vas != null && (vas < 0 || vas > 10)) {
    return Response.json({ error: "ערך VAS חייב להיות בין 0 ל-10." }, { status: 400 });
  }

  const validType = type && type in TREATMENT_TYPE_HE ? type : "follow_up";

  const clinicId = await resolveClinicId(supabase, user.id);
  if (!clinicId) return Response.json({ error: "No active clinic" }, { status: 400 });

  const template = await getClinicTemplate(supabase, clinicId);

  // Build snapshot from template (server-authoritative ordering/labels)
  const noteSections = template.sections
    .map((s) => ({
      key: s.key,
      label: s.label,
      letter: s.letter,
      content: (sections?.[s.key] ?? "").trim(),
    }))
    .filter((s) => s.content);

  const note = noteSections.length
    ? { template_id: template.id, template_name: template.name, sections: noteSections }
    : null;

  // Fill legacy SOAP columns when keys match (backward compat for queries that read them directly)
  const legacy: Record<string, string | null> = {
    subjective: null, objective: null, assessment: null, plan: null,
  };
  for (const s of noteSections) {
    if (SOAP_LEGACY.has(s.key)) legacy[s.key] = s.content;
  }

  const { error } = await supabase.from("treatments").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    therapist_id: user.id,
    type: validType,
    ...legacy,
    vas: vas ?? null,
    note,
    template_id: template.id,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
