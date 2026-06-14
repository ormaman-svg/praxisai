// Generate a home-exercise program from free text (e.g. a treatment plan)
// using the provider-agnostic AI layer. Returns { title, items: [...] }.

import { createClient } from "@/lib/supabase/server";
import { invoke } from "@/lib/ai/invoke";

const SYSTEM = `אתה פיזיותרפיסט מומחה. המשתמש ייתן לך תיאור חופשי של תוכנית טיפול / המלצות.
החזר אך ורק JSON תקין במבנה הבא, ללא טקסט נוסף:
{"title":"שם התוכנית","items":[{"name":"שם התרגיל","sets":3,"reps":10,"hold_sec":0,"frequency":"daily"}]}
כללים: 3-6 תרגילים, שמות בעברית, frequency אחד מ: daily / 2x_daily / alternate_days.`;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await request.json();
  if (!source?.trim()) return Response.json({ error: "חסר טקסט מקור." }, { status: 400 });

  try {
    const result = await invoke({
      system: SYSTEM,
      messages: [{ role: "user", content: source.trim() }],
      maxTokens: 800,
    });
    // Extract JSON (model may wrap in code fences)
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "ה-AI לא החזיר תוכנית תקינה." }, { status: 502 });
    const parsed = JSON.parse(match[0]);
    return Response.json(parsed);
  } catch (e) {
    console.error("[hep/generate] error:", e);
    return Response.json({ error: "יצירת התוכנית נכשלה." }, { status: 500 });
  }
}
