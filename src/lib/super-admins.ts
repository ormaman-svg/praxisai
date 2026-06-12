// Pure module — safe for both server and client imports.
// Platform super admins: define clinic character (documentation template),
// create clinics, and invite the clinic manager who takes over from there.
export const SUPER_ADMIN_EMAILS = ["or.maman@gmail.com", "eygeva@gmail.com"];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return SUPER_ADMIN_EMAILS.includes((email ?? "").trim().toLowerCase());
}
