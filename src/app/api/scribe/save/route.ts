import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { templateLeaves, AI_RECS_KEY } from "@/lib/clinic-templates";
import { TREATMENT_TYPE_HE } from "@/lib/types";

const SOAP_LEGACY = ["subjective", "objective", "assessment", "plan"] as const;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { patientId, type, vas, sections, aiRecommendations } = body as {
    patientId: string;
    type?: string;
    vas?: number | null;
    sections?: Record<string, string>;
    aiRecommendations?: string | null;
  };

  if (!patientId) return Response.json({ error: "Patient required" }, { status: 400 });

  if (vas != null && (vas < 0 || vas > 10)) {
    return Response.json({ error: "ערך VAS חייב להיות בין 0 ל-10." }, { status: 400 });
  }

  const validType = type && type in TREATMENT_TYPE_HE ? type : "follow_up";

  const clinicId = await resolveClinicId(supabase, user.id);
  if (!clinicId) return Response.json({ error: "No active clinic" }, { status: 400 });

  const template = await getClinicTemplate(supabase, clinicId);
  const leaves = templateLeaves(template);

  // Build snapshot from template leaves (server-authoritative ordering/labels).
  // Sub-fields are stored as their own rows so the saved note mirrors the form.
  const noteSections = leaves
    .map((l) => ({
      key: l.key,
      label: l.label,
      letter: l.letter,
      content: (sections?.[l.key] ?? "").trim(),
    }))
    .filter((s) => s.content);

  const aiRecs = (aiRecommendations ?? "").trim();

  const note = (noteSections.length || aiRecs)
    ? {
        template_id: template.id,
        template_name: template.name,
        sections: noteSections,
        ...(aiRecs ? { ai_recommendations: aiRecs } : {}),
      }
    : null;

  // Fill legacy SOAP columns (backward compat). For sectioned-into-subfields
  // parents, concatenate each sub-field as "label: content" lines.
  const legacy: Record<string, string | null> = {
    subjective: null, objective: null, assessment: null, plan: null,
  };
  for (const parent of SOAP_LEGACY) {
    const parts = leaves
      .filter((l) => l.parentKey === parent)
      .map((l) => {
        const content = (sections?.[l.key] ?? "").trim();
        if (!content) return null;
        // Single-field section (key === parent) → raw content; sub-fields get a label.
        return l.key === parent ? content : `${l.label}: ${content}`;
      })
      .filter(Boolean) as string[];
    if (parts.length) legacy[parent] = parts.join("\n");
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
