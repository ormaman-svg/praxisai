// SERVER ONLY — decides whether an authenticated email is allowed into the system.
// Enforces the invite-only policy: a user may enter only if they are the super
// admin, already belong to a clinic, or have a pending invitation.
import { createAdminClient } from "@/lib/supabase/admin";

export const SUPER_ADMIN_EMAIL = "or.maman@gmail.com";

export async function isEmailAllowed(email: string, userId?: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (e === SUPER_ADMIN_EMAIL) return true;

  const admin = createAdminClient();

  // Any membership (active or disabled) means the user belongs here.
  if (userId) {
    const { data: member } = await admin
      .from("clinic_members")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (member) return true;
  }

  // A pending invitation lets a brand-new user complete onboarding.
  const { data: invite } = await admin
    .from("invitations")
    .select("id")
    .ilike("email", e)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  return !!invite;
}
