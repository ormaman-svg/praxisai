import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import BillingClient from "./BillingClient";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
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

  const [{ data: membership }, { data: clinic }, { data: sub }, members, patients] = await Promise.all([
    supabase.from("clinic_members").select("role").eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single(),
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("subscriptions").select("*").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinic_members").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
  ]);

  if (!["owner", "admin"].includes(membership?.role ?? "")) redirect("/dashboard");

  return (
    <BillingClient
      clinicName={clinic?.name ?? ""}
      subscription={(sub as Subscription | null) ?? null}
      memberCount={members.count ?? 0}
      patientCount={patients.count ?? 0}
    />
  );
}
