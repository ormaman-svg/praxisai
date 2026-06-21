import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Derive the clinic from the patient row — ensures the caller is a member.
  const { data: patient } = await supabase
    .from("patients")
    .select("clinic_id")
    .eq("id", params.id)
    .single();
  if (!patient) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: memberErr } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", patient.clinic_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (memberErr) return Response.json({ error: "Forbidden" }, { status: 403 });

  const allowed = [
    "first_name", "last_name", "national_id", "dob", "phone", "email",
    "kupah", "diagnosis", "status", "primary_therapist_id", "bituach_leumi_case",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }

  const { error } = await supabase.from("patients").update(patch).eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
