import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

type PatientRow = {
  first_name: string;
  last_name: string;
  national_id?: string | null;
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  kupah?: string | null;
  diagnosis?: string | null;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return Response.json({ error: "אין קליניקה פעילה." }, { status: 400 });

  const { data: membership } = await supabase
    .from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
  if (!["owner", "admin", "therapist"].includes(membership?.role ?? "")) {
    return Response.json({ error: "אין הרשאה לייבא מטופלים." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rows: PatientRow[] = Array.isArray(body?.patients) ? body.patients : [];

  if (rows.length === 0) return Response.json({ error: "לא נמצאו שורות לייבוא." }, { status: 400 });
  if (rows.length > 500) return Response.json({ error: "מקסימום 500 מטופלים בייבוא אחד." }, { status: 400 });

  const VALID_KUPOT = ["כללית", "מכבי", "מאוחדת", "לאומית", "פרטי"];
  const records = rows
    .filter((r) => r.first_name?.trim() && r.last_name?.trim())
    .map((r) => ({
      clinic_id: clinicId!,
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      national_id: r.national_id?.trim() || null,
      phone: r.phone?.trim() || null,
      email: r.email?.trim().toLowerCase() || null,
      dob: r.dob?.trim() || null,
      kupah: VALID_KUPOT.includes(r.kupah ?? "") ? r.kupah : "כללית",
      diagnosis: r.diagnosis?.trim() || null,
    }));

  if (records.length === 0) return Response.json({ error: "לא נמצאו שורות תקינות עם שם פרטי ושם משפחה." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("patients").insert(records);
  if (error) return Response.json({ error: "הייבוא נכשל: " + error.message }, { status: 500 });

  return Response.json({ inserted: records.length });
}
