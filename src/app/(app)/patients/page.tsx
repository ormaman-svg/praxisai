import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import PatientsClient from "./PatientsClient";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const [{ data: patients }, { data: memberships }] = await Promise.all([
    supabase.from("patients").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false }),
    supabase.from("clinic_members").select("user_id, role, profiles!clinic_members_user_id_fkey(id, full_name)").eq("clinic_id", clinicId).eq("status", "active"),
  ]);

  const myRole = (memberships ?? []).find((m: any) => m.user_id === user!.id)?.role ?? "";
  const canDelete = myRole === "owner" || myRole === "admin";

  return (
    <PatientsClient
      clinicId={clinicId}
      initialPatients={patients ?? []}
      therapists={(memberships ?? []).map((t: any) => ({ id: t.user_id, name: t.profiles?.full_name ?? "" }))}
      canDelete={canDelete}
    />
  );
}
