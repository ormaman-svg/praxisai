// SERVER ONLY — service role bypasses RLS. Never import from client components.
import { createClient as createSb } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
