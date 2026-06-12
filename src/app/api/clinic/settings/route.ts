import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) return NextResponse.json({ error: "אין קליניקה פעילה" }, { status: 404 });
    if (!isSuperAdmin && !["owner", "admin"].includes(m.role))
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    clinicId = m.clinic_id;
  } else {
    // Verify caller is admin in this clinic (unless super admin)
    if (!isSuperAdmin) {
      const { data: m } = await supabase
        .from("clinic_members").select("role")
        .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
      if (!m || !["owner", "admin"].includes(m.role))
        return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
  }

  const patch = await req.json(); // { template_id: string, ... }

  // Merge with existing settings
  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId!).single();
  const existing = (clinic?.settings ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...patch };

  const { error } = await admin.from("clinics").update({ settings: merged }).eq("id", clinicId!);
  if (error) return NextResponse.json({ error: "שמירת ההגדרות נכשלה" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
