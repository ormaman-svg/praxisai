"use client";
import { createBrowserClient } from "@supabase/ssr";

// Hard session policy: cookies live at most 8 hours.
// The absolute 8-hour cutoff (no sliding renewal) is enforced in middleware.ts.
export const SESSION_MAX_AGE = 60 * 60 * 8;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { maxAge: SESSION_MAX_AGE } }
  );
}
