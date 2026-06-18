// Returns a conversation's messages with bodies decrypted for authorized
// clinic staff. Message bodies are encrypted at rest, so the browser can no
// longer read them directly from Supabase — it goes through here instead.
import { createClient } from "@/lib/supabase/server";
import { decryptMessage } from "@/lib/crypto/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = new URL(request.url).searchParams.get("conversation_id");
  if (!conversationId) return Response.json({ error: "missing conversation_id" }, { status: 400 });

  // RLS ensures the user can only read messages for conversations in their clinic
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, media_url, media_type, reply_to_id, wa_message_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: "load failed" }, { status: 500 });

  const messages = (data ?? []).map((m) => ({ ...m, body: decryptMessage(m.body) }));
  return Response.json({ messages });
}
