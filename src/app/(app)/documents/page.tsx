import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import DocumentsClient from "./DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const [{ data: docs }, { data: patients }] = await Promise.all([
    supabase.from("documents")
      .select("*, patients(first_name,last_name)")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false }),
    supabase.from("patients").select("id, first_name, last_name").eq("clinic_id", clinicId).order("first_name"),
  ]);

  return <DocumentsClient clinicId={clinicId} docs={(docs ?? []) as any} patients={patients ?? []} />;
}
