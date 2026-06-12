// SERVER ONLY — decides whether an authenticated email is allowed into the system.
// Enforces the invite-only policy: a user may enter only if they are the super
// admin, already belong to a clinic, or have a pending invitation.
import { createAdminClient } from "@/lib/supabase/admin";

import { SUPER_ADMIN_EMAILS, isSuperAdminEmail } from "@/lib/super-admins";

export { SUPER_ADMIN_EMAILS, isSuperAdminEmail };
// Kept for backwards compatibility with single-email checks.
export const SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAILS[0];

export async function isEmailAllowed(email: string, userId?: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (isSuperAdminEmail(e)) return true;

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
