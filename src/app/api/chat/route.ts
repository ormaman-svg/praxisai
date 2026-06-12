import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";

const BASE_SYSTEM = `אתה עוזר AI קליני מתמחה בפיזיותרפיה, עובד עם פיזיותרפיסטים בישראל.
אתה עונה בעברית תמיד, אלא אם המשתמש פנה באנגלית.
אתה מכיר פרוטוקולי שיקום, אנטומיה, פתולוגיות שכיחות בפיזיותרפיה, ותהליכי תיעוד קליני.
ענה תמיד בצורה מקצועית, ממוקדת ומועילה. אם שאלה חורגת מתחום הפיזיותרפיה, הפנה בעדינות בחזרה לנושאים קליניים.`;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let SYSTEM = BASE_SYSTEM;
  try {
    const clinicId = await resolveClinicId(supabase, user.id);
    const template = await getClinicTemplate(supabase, clinicId);
    SYSTEM += `\nהקליניקה מתעדת בפורמט "${template.name}" עם הסעיפים: ${template.sections.map((s) => s.label).join(", ")}.`;
    if (template.systemContext) SYSTEM += `\n${template.systemContext}`;
  } catch {
    // non-critical — proceed with base system prompt
  }

  const { messages } = await request.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CL_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      stream: true,
      system: SYSTEM,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) return Response.json({ error: "AI error" }, { status: 500 });

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); controller.close(); break; }
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ delta: { text: parsed.delta?.text ?? "" } })}\n\n`));
            }
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
