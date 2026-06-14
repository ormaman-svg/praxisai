import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignature } from "@/lib/whatsapp/verify";
import { findPatientByPhone } from "@/lib/whatsapp/normalize";
import { sendText } from "@/lib/whatsapp/client";
import { invoke } from "@/lib/ai/invoke";
import { PATIENT_AGENT_TOOLS } from "@/lib/ai/tools/definitions";
import { runToolCall } from "@/lib/ai/tools/handlers";
import type { Message } from "@/lib/ai/invoke";

const MAX_AGENT_TURNS = 5;

const PATIENT_AGENT_SYSTEM = `אתה עוזר אוטומטי של קליניקה פרא-רפואית, המתקשר עם מטופלים דרך WhatsApp.
כללים חשובים:
- אתה עונה בעברית תמיד (אלא אם המטופל כותב בערבית — אז בערבית).
- אסור לך לתת ייעוץ רפואי, אבחנות, או המלצות טיפול. אם נשאלת — הסלם לאדם.
- אתה יכול: לאשר/לבטל/לדחות תורים, לשלוח קישור תשלום, לרשום ביצוע תרגילי בית, לאסוף ציוני תוצאה שבועיים.
- הודעות קצרות וידידותיות. לא יותר מ-3 משפטים.
- אם אינך בטוח — הסלם לאדם (escalate_to_human).`;

// GET — 360dialog webhook verification challenge
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verify = url.searchParams.get("hub.verify_token");
  if (verify !== process.env.WA_VERIFY_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge ?? "ok", { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Verify signature (optional but strongly recommended in production)
  const sig = request.headers.get("X-Hub-Signature-256") ?? "";
  const appSecret = process.env.WA_APP_SECRET ?? "";
  if (appSecret && !verifySignature(rawBody, sig, appSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // 360dialog sends: { entry: [{ changes: [{ value: { messages, metadata } }] }] }
  const entry = (payload.entry as { changes: { value: Record<string, unknown> }[] }[])?.[0];
  const value = entry?.changes?.[0]?.value;
  const inboundMessages = value?.messages as { id: string; from: string; text?: { body: string }; type: string }[] | undefined;

  if (!inboundMessages?.length) {
    // Status updates — acknowledge silently
    return Response.json({ ok: true });
  }

  const supabase = createAdminClient();

  for (const msg of inboundMessages) {
    if (msg.type !== "text" || !msg.text?.body) continue;

    const fromPhone = msg.from; // E.164 from 360dialog
    const inboundText = msg.text.body.trim();

    // Find which clinic owns this phone_id
    // In production: look up clinic by wa_phone_id from metadata
    // For now: find by patient phone across all clinics (simplified)
    const { data: clinicRows } = await supabase
      .from("clinics")
      .select("id, settings")
      .not("settings->wa_phone_id", "is", null)
      .limit(50);

    let clinicId: string | null = null;
    let waPhoneId: string | null = null;
    let waApiKey: string | null = null;
    let patient: { id: string; first_name: string; last_name: string } | null = null;

    for (const clinic of clinicRows ?? []) {
      const found = await findPatientByPhone(supabase, clinic.id, fromPhone);
      if (found) {
        clinicId = clinic.id;
        waPhoneId = clinic.settings?.wa_phone_id ?? null;
        waApiKey = clinic.settings?.wa_api_key ?? null;
        patient = found;
        break;
      }
    }

    if (!clinicId || !waPhoneId || !waApiKey) continue; // Unknown sender

    const creds = { phoneId: waPhoneId, apiKey: waApiKey };

    // Upsert conversation
    let { data: conv } = await supabase
      .from("conversations")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("wa_contact", fromPhone)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conv) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          clinic_id: clinicId,
          patient_id: patient?.id ?? null,
          channel: "whatsapp",
          wa_contact: fromPhone,
          status: "bot",
          last_message_at: new Date().toISOString(),
        })
        .select("id, status")
        .single();
      conv = newConv;
    } else {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conv.id);
    }

    if (!conv) continue;

    // Save inbound message
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      direction: "inbound",
      body: inboundText,
      wa_message_id: msg.id,
      status: "delivered",
      sent_at: new Date().toISOString(),
    });

    // If handed to human — skip bot
    if (conv.status === "human") continue;

    // Handle opt-out keywords
    const lower = inboundText.toLowerCase();
    if (["stop", "עצור", "הסר", "בטל רישום"].some((k) => lower.includes(k))) {
      if (patient) {
        await supabase.from("patient_consents")
          .upsert({ patient_id: patient.id, channel: "whatsapp", opted_in: false, source: "reply_stop", consented_at: new Date().toISOString() });
      }
      await sendText(creds, fromPhone, "הוסרת מרשימת ההתראות. שלח START בכל עת לחידוש.");
      continue;
    }

    // Load recent messages for context (last 10)
    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("direction, body")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const history: Message[] = (recentMsgs ?? [])
      .reverse()
      .map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.body ?? "" }));

    // Load patient context
    const { data: nextAppt } = patient
      ? await supabase
          .from("appointments")
          .select("id, starts_at, therapist_id, profiles:therapist_id(full_name)")
          .eq("patient_id", patient.id)
          .eq("status", "scheduled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(1)
          .single()
      : { data: null };

    const { data: activeProgram } = patient
      ? await supabase
          .from("exercise_programs")
          .select("id, title")
          .eq("patient_id", patient.id)
          .eq("active", true)
          .limit(1)
          .single()
      : { data: null };

    const systemWithContext = PATIENT_AGENT_SYSTEM + (patient
      ? `\n\nמידע על המטופל:\nשם: ${patient.first_name} ${patient.last_name}\n` +
        (nextAppt ? `פגישה הבאה: ${new Date((nextAppt as { starts_at: string }).starts_at).toLocaleString("he-IL")} (appointment_id: ${(nextAppt as { id: string }).id})\n` : "אין פגישות קרובות.\n") +
        (activeProgram ? `תוכנית תרגול פעילה: "${(activeProgram as { title: string }).title}" (program_id: ${(activeProgram as { id: string }).id})\n` : "") +
        `patient_id: ${patient.id}, clinic_id: ${clinicId}, conversation_id: ${conv.id}`
      : "");

    // Agent loop
    let agentMessages: Message[] = [...history];
    let replyText = "";

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      const result = await invoke({
        system: systemWithContext,
        messages: agentMessages,
        tools: PATIENT_AGENT_TOOLS,
        maxTokens: 512,
      });

      if (result.toolCalls.length) {
        const toolResults: string[] = [];
        for (const tc of result.toolCalls) {
          const res = await runToolCall(tc, supabase);
          toolResults.push(res);
        }
        // Add assistant's tool use turn + tool results as user turn
        agentMessages = [
          ...agentMessages,
          { role: "assistant", content: result.text + (result.toolCalls.length ? `\n[כלים: ${result.toolCalls.map((t) => t.name).join(", ")}]` : "") },
          { role: "user", content: toolResults.join("\n") },
        ];
        if (result.stopReason === "end_turn" || !result.toolCalls.length) break;
      } else {
        replyText = result.text;
        break;
      }
    }

    if (!replyText) {
      replyText = "תודה על ההודעה. נציג יחזור אליכם בהקדם.";
    }

    // Send reply
    const waId = await sendText(creds, fromPhone, replyText);

    // Save outbound message
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      body: replyText,
      wa_message_id: waId || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  }

  return Response.json({ ok: true });
}
