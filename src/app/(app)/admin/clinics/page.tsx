import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClinicsClient from "./ClinicsClient";

export const dynamic = "force-dynamic";

const SUPER_ADMIN = "or.maman@gmail.com";

export default async function ClinicsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== SUPER_ADMIN) redirect("/dashboard");

  const { data: clinics } = await supabase
    .from("clinics")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  return <ClinicsClient clinics={clinics ?? []} />;
}
