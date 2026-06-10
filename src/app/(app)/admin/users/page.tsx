import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";
import UsersClient from "./UsersClient";
import type { MemberRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
  const admin = createAdminClient();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) redirect("/dashboard");

  // Determine the viewer's role in this clinic. Super admin is treated as
  // owner even when not a real member, so they can manage any clinic.
  const { data: me } = await admin
    .from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").maybeSingle();

  let myRole: MemberRole | null = (me?.role as MemberRole) ?? null;
  if (!myRole && isSuperAdmin) myRole = "owner";
  if (!myRole || !["owner", "admin"].includes(myRole)) redirect("/dashboard");

  // Load members + invitations with the admin client so RLS doesn't hide
  // other members of the clinic from the manager.
  const [{ data: members }, { data: invitations }] = await Promise.all([
    admin.from("clinic_members")
      .select("*, profiles(id, full_name)")
      .eq("clinic_id", clinicId).order("created_at"),
    admin.from("invitations")
      .select("*")
      .eq("clinic_id", clinicId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);

  return (
    <UsersClient
      clinicId={clinicId}
      myUserId={user.id}
      myRole={myRole}
      members={(members ?? []) as any}
      invitations={invitations ?? []}
    />
  );
}
