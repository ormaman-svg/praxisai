// Start a new WhatsApp conversation with an arbitrary number (like WhatsApp's
// "new chat"). Creates/links the conversation and sends the first message.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { findPatientByPhone, normalizePhone } from "@/lib/whatsapp/normalize";
import { getOrCreateConversation } from "@/lib/whatsapp/agent";
import { sendText as evolutionSendText, toChatId } from "@/lib/whatsapp/evolution-api";
import { encryptMessage } from "@/lib/crypto/messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  if (!clinicId) return Response.json({ error: "אין קליניקה פעילה" }, { status: 403 });

  const { phone, text } = await request.json();
  if (!phone?.trim() || !text?.trim())
    return Response.json({ error: "יש להזין מספר טלפון והודעה." }, { status: 400 });

  const contact = normalizePhone(phone); // E.164, e.g. +972527305577
  if (!/^\+\d{9,15}$/.test(contact))
    return Response.json({ error: "מספר טלפון לא תקין." }, { status: 400 });

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
  const s = (clinic?.settings ?? {}) as Record<string, string>;
  if (!s.evolution_host || !s.evolution_instance || !s.evolution_api_key)
    return Response.json({ error: "WhatsApp לא מחובר לקליניקה." }, { status: 400 });

  const patient = await findPatientByPhone(admin, clinicId, contact);
  const displayName = patient ? `${patient.first_name} ${patient.last_name}` : null;
  const conversationId = await getOrCreateConversation(admin, clinicId, patient?.id ?? null, contact, displayName ?? undefined);
  if (!conversationId) return Response.json({ error: "יצירת שיחה נכשלה." }, { status: 500 });

  // Staff-initiated → human-owned so the bot doesn't jump in
  await admin.from("conversations").update({ status: "human", assigned_to: user.id }).eq("id", conversationId);

  let waId = "";
  try {
    waId = await evolutionSendText(
      { host: s.evolution_host, instance: s.evolution_instance, apiKey: s.evolution_api_key },
      toChatId(contact),
      text.trim()
    );
  } catch (e) {
    console.error("[new-chat] send error:", e);
    return Response.json({ error: "שליחת ההודעה נכשלה. ודאו שהמספר תקין ומחובר ל-WhatsApp." }, { status: 502 });
  }

  await admin.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    body: encryptMessage(text.trim()),
    wa_message_id: waId || null,
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  // Return the conversation shaped like the inbox list rows
  const { data: conv } = await admin
    .from("conversations")
    .select("id, status, wa_contact, display_name, last_message_at, patient_id, patients(first_name, last_name, phone, status)")
    .eq("id", conversationId)
    .single();

  return Response.json({ ok: true, conversation: conv });
}
