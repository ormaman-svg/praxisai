import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  // ±8 weeks of appointments — week navigation happens client-side.
  const from = new Date(Date.now() - 56 * 864e5).toISOString();
  const to = new Date(Date.now() + 56 * 864e5).toISOString();

  const [{ data: appointments }, { data: patients }, { data: members }] = await Promise.all([
    supabase.from("appointments")
      .select("*")
      .eq("clinic_id", clinicId).gte("starts_at", from).lte("starts_at", to)
      .order("starts_at"),
    supabase.from("patients")
      .select("id, first_name, last_name")
      .eq("clinic_id", clinicId).eq("status", "active").order("first_name"),
    supabase.from("clinic_members")
      .select("user_id, role, profiles(full_name)")
      .eq("clinic_id", clinicId).eq("status", "active"),
  ]);

  const therapists = (members ?? [])
    .filter((m) => ["owner", "admin", "therapist"].includes(m.role))
    .map((m) => ({
      id: m.user_id,
      name: (m.profiles as unknown as { full_name: string } | null)?.full_name ?? "מטפל",
    }));

  return (
    <ScheduleClient
      clinicId={clinicId}
      userId={user.id}
      appointments={appointments ?? []}
      patients={patients ?? []}
      therapists={therapists}
    />
  );
}
