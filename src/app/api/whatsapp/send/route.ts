// Manual outbound reply from a human agent in the inbox.
// Sends a free-form WhatsApp text (valid only inside the 24h service window)
// and records it as an outbound message.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { sendText as evolutionSendText, toChatId } from "@/lib/whatsapp/evolution-api";
import { normalizePhone } from "@/lib/whatsapp/normalize";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { conversation_id, text } = await request.json();
  if (!conversation_id || !text?.trim()) {
    return Response.json({ error: "חסר תוכן הודעה." }, { status: 400 });
  }

  // RLS ensures the user can only read conversations in their clinic
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, clinic_id, wa_contact, patient_id, patients(phone)")
    .eq("id", conversation_id)
    .single();
  if (!conv?.wa_contact) return Response.json({ error: "שיחה לא נמצאה." }, { status: 404 });

  // The stored wa_contact may be an @lid JID (not routable). When a patient is
  // linked, send to their real phone; otherwise fall back to wa_contact.
  const patientRel = conv.patients as unknown as { phone: string | null } | { phone: string | null }[] | null;
  const patientPhone = (Array.isArray(patientRel) ? patientRel[0] : patientRel)?.phone ?? null;
  const target = patientPhone
    ? toChatId(normalizePhone(patientPhone))
    : conv.wa_contact;
  if (conv.wa_contact.endsWith("@lid") && !patientPhone) {
    return Response.json(
      { error: "לא ניתן לשלוח — אין מספר טלפון. הוסיפו את הפונה כמטופל עם מספר תקין." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", conv.clinic_id).single();
  const settings = (clinic?.settings ?? {}) as Record<string, string>;

  const evolutionHost = settings.evolution_host;
  const evolutionInstance = settings.evolution_instance;
  const evolutionKey = settings.evolution_api_key;
  const phoneNumberId = settings.wa_phone_number_id;
  const accessToken = settings.wa_access_token;

  const hasEvolution = !!evolutionHost && !!evolutionInstance && !!evolutionKey;
  const hasMeta = !!phoneNumberId && !!accessToken;

  if (!hasEvolution && !hasMeta) {
    return Response.json({ error: "WhatsApp לא מחובר לקליניקה." }, { status: 400 });
  }

  let waId = "";
  try {
    if (hasEvolution) {
      waId = await evolutionSendText(
        { host: evolutionHost, instance: evolutionInstance, apiKey: evolutionKey },
        target,
        text.trim()
      );
    } else {
      waId = await sendText({ phoneNumberId: phoneNumberId!, accessToken: accessToken! }, target, text.trim());
    }
  } catch (e) {
    console.error("[whatsapp/send] error:", e);
    return Response.json({ error: "שליחת ההודעה נכשלה." }, { status: 500 });
  }

  await admin.from("messages").insert({
    conversation_id,
    direction: "outbound",
    body: text.trim(),
    wa_message_id: waId || null,
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation_id);

  return Response.json({ ok: true });
}
