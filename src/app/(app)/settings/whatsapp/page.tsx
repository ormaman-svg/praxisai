import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import WhatsAppClient from "./WhatsAppClient";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let clinicId = getActiveClinicId();
  let role = "";
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
    role = m?.role ?? "";
  } else {
    const { data: m } = await supabase
      .from("clinic_members").select("role").eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
    role = m?.role ?? "";
  }
  if (!clinicId) return null;
  if (!["owner", "admin"].includes(role)) redirect("/dashboard");

  const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId).single();
  const s = (clinic?.settings ?? {}) as Record<string, unknown>;

  return (
    <WhatsAppClient
      initial={{
        wa_phone_number_id: (s.wa_phone_number_id as string) ?? "",
        wa_waba_id: (s.wa_waba_id as string) ?? "",
        hasAccessToken: !!s.wa_access_token,
        reminder24h: s.wa_reminder_24h !== false,
        reminder2h: s.wa_reminder_2h !== false,
      }}
    />
  );
}
