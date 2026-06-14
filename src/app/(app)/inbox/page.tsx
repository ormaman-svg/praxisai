import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, wa_contact, last_message_at, patient_id, patients(first_name, last_name)")
    .eq("clinic_id", clinicId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return <InboxClient clinicId={clinicId} userId={user!.id} initialConversations={(conversations ?? []) as any} />;
}
