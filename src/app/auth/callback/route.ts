import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailAllowed } from "@/lib/auth-gate";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const email = data.user.email ?? "";
      const allowed = await isEmailAllowed(email, data.user.id);

      if (!allowed) {
        // Invite-only: this Google account was never invited. Sign out and,
        // if it was just auto-created by this OAuth flow, remove it so the
        // auth table stays clean. Guard on a recent created_at so an
        // established account is never deleted on a transient lookup failure.
        await supabase.auth.signOut();
        try {
          const createdAt = new Date(data.user.created_at).getTime();
          const isFreshSignup = Date.now() - createdAt < 5 * 60 * 1000;
          if (isFreshSignup) {
            await createAdminClient().auth.admin.deleteUser(data.user.id);
          }
        } catch {
          // best-effort cleanup
        }
        return NextResponse.redirect(`${origin}/login?error=not_invited`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
