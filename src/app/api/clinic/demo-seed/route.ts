import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { isSuperAdminEmail } from "@/lib/super-admins";
import { getClinicTemplate } from "@/lib/clinic-template-server";
import { seedDemoClinic } from "@/lib/demo-seed";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Regenerating demo data is destructive — restrict to platform super admins.
  if (!isSuperAdminEmail(user.email)) {
    return Response.json({ error: "פעולה זו זמינה למנהל המערכת בלבד." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let clinicId: string | null = body?.clinicId ?? getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return Response.json({ error: "אין קליניקה פעילה." }, { status: 400 });

  const admin = createAdminClient();

  // Only demo clinics may have their data wiped & regenerated.
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
  const settings = (clinic?.settings ?? {}) as Record<string, unknown>;
  if (settings.is_demo !== true) {
    return Response.json({ error: "פעולה זו זמינה רק בקליניקת דמו." }, { status: 403 });
  }

  const template = await getClinicTemplate(supabase, clinicId);

  const { data: members } = await admin
    .from("clinic_members").select("user_id").eq("clinic_id", clinicId).eq("status", "active");
  const therapistIds = (members ?? []).map((m) => m.user_id as string);

  const counts = await seedDemoClinic(admin, clinicId, template, { therapistIds, createdBy: user.id });

  return Response.json({ ok: true, profession: template.profession, ...counts });
}
