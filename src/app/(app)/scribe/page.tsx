import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import { DEFAULT_TEMPLATE_ID } from "@/lib/clinic-templates";
import ScribeClient from "./ScribeClient";

export const dynamic = "force-dynamic";

export default async function ScribePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }

  let templateId = DEFAULT_TEMPLATE_ID;
  if (clinicId) {
    const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId!).single();
    templateId = (clinic?.settings as any)?.template_id ?? DEFAULT_TEMPLATE_ID;
  }

  return <ScribeClient templateId={templateId} />;
}
