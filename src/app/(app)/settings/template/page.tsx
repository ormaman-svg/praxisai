import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import { isSuperAdminEmail } from "@/lib/super-admins";
import TemplateClient from "./TemplateClient";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Documentation template defines the clinic's character — platform super admins only.
  if (!isSuperAdminEmail(user.email)) redirect("/dashboard");

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) redirect("/dashboard");
    clinicId = m.clinic_id;
  }

  const { data: clinic } = await supabase.from("clinics").select("name, settings").eq("id", clinicId!).single();
  const settings = (clinic?.settings ?? {}) as Record<string, unknown>;

  return (
    <TemplateClient
      clinicName={clinic?.name ?? ""}
      currentTemplateId={(settings.template_id as string) ?? null}
      isDemo={settings.is_demo === true}
    />
  );
}
