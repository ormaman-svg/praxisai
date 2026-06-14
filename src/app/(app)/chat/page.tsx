import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { getProfessionChat } from "@/lib/clinic-templates";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Tailor the assistant to the clinic's profession (falls back gracefully).
  let chat = getProfessionChat(null);
  if (user) {
    try {
      const clinicId = await resolveClinicId(supabase, user.id);
      const template = await getClinicTemplate(supabase, clinicId);
      chat = getProfessionChat(template.profession);
    } catch {
      // non-critical — keep generic paramedical framing
    }
  }

  return <ChatClient expertise={chat.expertise} starters={chat.starters} />;
}
