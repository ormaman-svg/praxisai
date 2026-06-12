import { getActiveClinicId } from "@/lib/clinic";
import { resolveTemplateFromSettings, TEMPLATE_MAP, DEFAULT_TEMPLATE_ID } from "@/lib/clinic-templates";
import type { ClinicalTemplate } from "@/lib/clinic-templates";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveClinicId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const fromCookie = getActiveClinicId();
  if (fromCookie) return fromCookie;
  const { data } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  return data?.clinic_id ?? null;
}

export async function getClinicTemplate(supabase: SupabaseClient, clinicId: string | null): Promise<ClinicalTemplate> {
  if (!clinicId) return TEMPLATE_MAP[DEFAULT_TEMPLATE_ID];
  const { data } = await supabase.from("clinics").select("settings").eq("id", clinicId).single();
  return resolveTemplateFromSettings(data?.settings);
}
