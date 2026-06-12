import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";
import TemplateClient from "./TemplateClient";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) redirect("/dashboard");
    if (!isSuperAdmin && !["owner", "admin"].includes(m.role)) redirect("/dashboard");
    clinicId = m.clinic_id;
  }

  const { data: clinic } = await supabase.from("clinics").select("name, settings").eq("id", clinicId!).single();
  const settings = (clinic?.settings ?? {}) as Record<string, string>;

  return (
    <TemplateClient
      clinicName={clinic?.name ?? ""}
      currentTemplateId={settings.template_id ?? null}
    />
  );
}
