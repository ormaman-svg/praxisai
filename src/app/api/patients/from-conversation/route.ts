import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) return Response.json({ error: "אין הרשאה" }, { status: 403 });
    clinicId = m.clinic_id;
  }

  const { conversation_id, first_name, last_name, phone } = await request.json();
  if (!conversation_id || !first_name?.trim() || !last_name?.trim())
    return Response.json({ error: "שם פרטי ושם משפחה הם שדות חובה." }, { status: 400 });

  const admin = createAdminClient();

  // Verify the conversation belongs to this clinic
  const { data: conv } = await admin
    .from("conversations")
    .select("id, clinic_id")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .single();
  if (!conv) return Response.json({ error: "שיחה לא נמצאה." }, { status: 404 });

  // Create the patient
  const { data: patient, error: pErr } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone?.trim() || null,
    })
    .select("id, first_name, last_name")
    .single();

  if (pErr || !patient)
    return Response.json({ error: "יצירת מטופל נכשלה: " + (pErr?.message ?? "") }, { status: 500 });

  // Link patient to the conversation
  const fullName = `${patient.first_name} ${patient.last_name}`;
  await admin
    .from("conversations")
    .update({ patient_id: patient.id, display_name: fullName })
    .eq("id", conversation_id);

  return Response.json({ ok: true, patient_id: patient.id, patient });
}
