import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clinicId = getActiveClinicId();
  if (!clinicId) return Response.json({ error: "No active clinic" }, { status: 400 });

  const { patientId, subjective, objective, assessment, plan, vas } = await request.json();
  if (!patientId) return Response.json({ error: "Patient required" }, { status: 400 });

  const { error } = await supabase.from("treatments").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    therapist_id: user.id,
    type: "follow_up",
    subjective: subjective || null,
    objective: objective || null,
    assessment: assessment || null,
    plan: plan || null,
    vas: vas ?? null,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
