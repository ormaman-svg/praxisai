import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const since = new Date(Date.now() - 180 * 864e5).toISOString(); // last 6 months

  const [{ data: patients }, { data: treatments }, { data: measurements }, { data: docs }] = await Promise.all([
    supabase.from("patients")
      .select("id, first_name, last_name, kupah, status, created_at")
      .eq("clinic_id", clinicId),
    supabase.from("treatments")
      .select("id, patient_id, treated_at, type, vas")
      .eq("clinic_id", clinicId).gte("treated_at", since).order("treated_at"),
    supabase.from("measurements")
      .select("id, patient_id, kind, joint, movement, value, unit, recorded_at")
      .eq("clinic_id", clinicId).gte("recorded_at", since).order("recorded_at"),
    supabase.from("documents")
      .select("id, patient_id, created_at")
      .eq("clinic_id", clinicId).gte("created_at", since),
  ]);

  return (
    <AnalyticsClient
      patients={patients ?? []}
      treatments={treatments ?? []}
      measurements={measurements ?? []}
      docs={docs ?? []}
    />
  );
}
