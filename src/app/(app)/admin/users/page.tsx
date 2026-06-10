import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) redirect("/dashboard");

  const { data: me } = await supabase
    .from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
  if (!me || !["owner", "admin"].includes(me.role)) redirect("/dashboard");

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("clinic_members")
      .select("*, profiles(id, full_name)")
      .eq("clinic_id", clinicId).order("created_at"),
    supabase.from("invitations")
      .select("*")
      .eq("clinic_id", clinicId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);

  return (
    <UsersClient
      clinicId={clinicId}
      myUserId={user.id}
      myRole={me.role}
      members={(members ?? []) as any}
      invitations={invitations ?? []}
    />
  );
}
