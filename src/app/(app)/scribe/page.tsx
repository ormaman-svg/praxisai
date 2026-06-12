import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import ScribeClient from "./ScribeClient";

export const dynamic = "force-dynamic";

export default async function ScribePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clinicId = await resolveClinicId(supabase, user.id);
  const template = await getClinicTemplate(supabase, clinicId);

  return <ScribeClient template={template} />;
}
