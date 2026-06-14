import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize phone to E.164 (adds +972 prefix for Israeli numbers if missing). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  if (digits.startsWith("+")) return raw.replace(/[^\d+]/g, "");
  return `+${digits}`;
}

/** Look up a patient by phone number within a clinic. Returns null if not found. */
export async function findPatientByPhone(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
): Promise<{ id: string; first_name: string; last_name: string } | null> {
  const normalized = normalizePhone(phone);

  // Try exact match first, then strip +972 prefix variation
  const { data } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("clinic_id", clinicId)
    .or(`phone.eq.${normalized},phone.eq.0${normalized.slice(4)}`)
    .limit(1)
    .single();

  return data ?? null;
}
