// Forward a message's content to another existing conversation or a new number.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { findPatientByPhone, normalizePhone } from "@/lib/whatsapp/normalize";
import { getOrCreateConversation } from "@/lib/whatsapp/agent";
import { sendText as evolutionSendText, sendMedia, toChatId } from "@/lib/whatsapp/evolution-api";
import { resolveSendTarget, patientPhoneFromRel } from "@/lib/whatsapp/target";

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

  const { message_id, to_conversation_id, to_phone } = await request.json();
  if (!message_id || (!to_conversation_id && !to_phone?.trim()))
    return Response.json({ error: "חסר יעד להעברה." }, { status: 400 });

  const admin = createAdminClient();

  // Source message — verify it belongs to this clinic
  const { data: src } = await admin
    .from("messages")
    .select("id, body, media_url, media_type, conversations(clinic_id)")
    .eq("id", message_id)
    .single();
  const srcConv = (Array.isArray(src?.conversations) ? src?.conversations[0] : src?.conversations) as
    | { clinic_id: string } | undefined;
  if (!src || !srcConv || srcConv.clinic_id !== clinicId)
    return Response.json({ error: "הודעה לא נמצאה." }, { status: 404 });

  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
  const s = (clinic?.settings ?? {}) as Record<string, string>;
  if (!s.evolution_host || !s.evolution_instance || !s.evolution_api_key)
    return Response.json({ error: "WhatsApp לא מחובר לקליניקה." }, { status: 400 });
  const creds = { host: s.evolution_host, instance: s.evolution_instance, apiKey: s.evolution_api_key };

  // Resolve the target conversation + routable number
  let targetConvId: string;
  let target: string | null;
  if (to_conversation_id) {
    const { data: tConv } = await admin
      .from("conversations")
      .select("id, clinic_id, wa_contact, patient_id, patients(phone)")
      .eq("id", to_conversation_id)
      .eq("clinic_id", clinicId)
      .single();
    if (!tConv?.wa_contact) return Response.json({ error: "שיחת יעד לא נמצאה." }, { status: 404 });
    targetConvId = tConv.id;
    const r = resolveSendTarget(tConv.wa_contact, patientPhoneFromRel(tConv.patients));
    if (!r.target) return Response.json({ error: r.error }, { status: 400 });
    target = r.target;
  } else {
    const contact = normalizePhone(to_phone);
    if (!/^\+\d{9,15}$/.test(contact))
      return Response.json({ error: "מספר טלפון לא תקין." }, { status: 400 });
    const patient = await findPatientByPhone(admin, clinicId, contact);
    const displayName = patient ? `${patient.first_name} ${patient.last_name}` : null;
    const id = await getOrCreateConversation(admin, clinicId, patient?.id ?? null, contact, displayName ?? undefined);
    if (!id) return Response.json({ error: "יצירת שיחה נכשלה." }, { status: 500 });
    await admin.from("conversations").update({ status: "human", assigned_to: user.id }).eq("id", id);
    targetConvId = id;
    target = toChatId(contact);
  }

  // Send the content. Media is re-sent via a fresh signed URL.
  let waId = "";
  try {
    if (src.media_url && src.media_type) {
      const { data: signed } = await admin.storage
        .from("whatsapp-media")
        .createSignedUrl(src.media_url, 600);
      const mt = (["image", "video", "audio", "document"].includes(src.media_type)
        ? src.media_type : "document") as "image" | "video" | "audio" | "document";
      if (signed?.signedUrl)
        waId = await sendMedia(creds, target, signed.signedUrl, src.body ?? "", mt);
    } else if (src.body) {
      waId = await evolutionSendText(creds, target, src.body);
    } else {
      return Response.json({ error: "אין תוכן להעברה." }, { status: 400 });
    }
  } catch (e) {
    console.error("[forward] send error:", e);
    return Response.json({ error: "ההעברה נכשלה." }, { status: 502 });
  }

  await admin.from("messages").insert({
    conversation_id: targetConvId,
    direction: "outbound",
    body: src.body,
    media_url: src.media_url,
    media_type: src.media_type,
    wa_message_id: waId || null,
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", targetConvId);

  return Response.json({ ok: true, conversation_id: targetConvId });
}
