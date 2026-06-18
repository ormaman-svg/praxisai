// Delete a single message. scope=me removes it from our inbox only;
// scope=everyone also revokes it on WhatsApp (outbound messages only).
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { deleteMessageForEveryone, type EvolutionCreds } from "@/lib/whatsapp/evolution-api";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m) return Response.json({ error: "אין הרשאה" }, { status: 403 });
    clinicId = m.clinic_id;
  }

  const scope = new URL(request.url).searchParams.get("scope") ?? "me";
  const admin = createAdminClient();

  // Load the message + its conversation (to verify clinic ownership + get remoteJid)
  const { data: msg } = await admin
    .from("messages")
    .select("id, direction, wa_message_id, conversation_id, conversations(clinic_id, wa_contact)")
    .eq("id", params.id)
    .single();
  const conv = (Array.isArray(msg?.conversations) ? msg?.conversations[0] : msg?.conversations) as
    | { clinic_id: string; wa_contact: string | null }
    | undefined;
  if (!msg || !conv || conv.clinic_id !== clinicId)
    return Response.json({ error: "הודעה לא נמצאה." }, { status: 404 });

  // Delete-for-everyone: revoke on WhatsApp first (only our own messages)
  if (scope === "everyone" && msg.direction === "outbound" && msg.wa_message_id && conv.wa_contact) {
    const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
    const s = (clinic?.settings ?? {}) as Record<string, string>;
    if (s.evolution_host && s.evolution_instance && s.evolution_api_key) {
      const creds: EvolutionCreds = {
        host: s.evolution_host, instance: s.evolution_instance, apiKey: s.evolution_api_key,
      };
      await deleteMessageForEveryone(creds, {
        id: msg.wa_message_id,
        remoteJid: conv.wa_contact,
        fromMe: true,
      }).catch(() => {});
    }
  }

  const { error } = await admin.from("messages").delete().eq("id", params.id);
  if (error) return Response.json({ error: "מחיקה נכשלה." }, { status: 500 });

  return Response.json({ ok: true });
}
