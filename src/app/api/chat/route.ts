import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { invokeStream } from "@/lib/ai/invoke";

function baseSystem(profession: string) {
  return `אתה עוזר AI קליני מומחה בתחום ${profession}, העובד עם אנשי מקצוע פרא-רפואיים בישראל.
אתה עונה בעברית תמיד, אלא אם המשתמש פנה באנגלית.
אתה מכיר פרוטוקולי טיפול, שיטות הערכה ואבחון, ותהליכי תיעוד קליני הרלוונטיים ל${profession}.
ענה תמיד בצורה מקצועית, ממוקדת, מועילה ומבוססת ראיות. אם שאלה חורגת מהתחום הקליני, הפנה בעדינות בחזרה לנושאים קליניים.`;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let SYSTEM = baseSystem("הבריאות הפרא-רפואית");
  try {
    const clinicId = await resolveClinicId(supabase, user.id);
    const template = await getClinicTemplate(supabase, clinicId);
    const profession = template.profession && template.profession !== "אחר"
      ? template.profession : "הבריאות הפרא-רפואית";
    SYSTEM = baseSystem(profession);
    SYSTEM += `\nהקליניקה מתעדת בפורמט "${template.name}" עם הסעיפים: ${template.sections.map((s) => s.label).join(", ")}.`;
    if (template.systemContext) SYSTEM += `\n${template.systemContext}`;
  } catch {
    // non-critical — proceed with generic system prompt
  }

  const { messages } = await request.json();

  try {
    const stream = await invokeStream({ system: SYSTEM, messages });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch {
    return Response.json({ error: "AI error" }, { status: 500 });
  }
}
