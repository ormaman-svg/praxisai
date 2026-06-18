// Message-content search. Bodies are encrypted at rest, so an ILIKE in SQL
// can't match them — we decrypt server-side and filter. Returns the set of
// conversation IDs whose messages contain the term.
import { createClient } from "@/lib/supabase/server";
import { decryptMessage } from "@/lib/crypto/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const term = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (term.length < 2) return Response.json({ conversationIds: [] });

  // RLS scopes this to the user's clinic. Bound the scan to recent messages.
  const { data } = await supabase
    .from("messages")
    .select("conversation_id, body")
    .order("created_at", { ascending: false })
    .limit(5000);

  const ids = new Set<string>();
  for (const m of data ?? []) {
    const body = decryptMessage(m.body);
    if (body && body.toLowerCase().includes(term)) ids.add(m.conversation_id as string);
  }
  return Response.json({ conversationIds: Array.from(ids) });
}
