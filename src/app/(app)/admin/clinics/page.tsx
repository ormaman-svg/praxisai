import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";
import ClinicsClient from "./ClinicsClient";

export const dynamic = "force-dynamic";

export default async function ClinicsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== SUPER_ADMIN_EMAIL) redirect("/dashboard");

  // Use the admin client so RLS doesn't hide clinics the super admin
  // isn't a member of — they must see every clinic in the system.
  const admin = createAdminClient();
  const { data: clinics } = await admin
    .from("clinics")
    .select("id, name, slug, created_at, members:clinic_members(count)")
    .order("created_at", { ascending: false });

  const rows = (clinics ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    created_at: c.created_at,
    memberCount: c.members?.[0]?.count ?? 0,
  }));

  return <ClinicsClient clinics={rows} />;
}
