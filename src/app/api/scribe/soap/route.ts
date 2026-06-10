import { createClient } from "@/lib/supabase/server";

const SYSTEM = `אתה עוזר קליני לפיזיותרפיסטים בישראל. קיבלת תמלול של שיחת טיפול פיזיותרפי.
תפקידך לחלץ את המידע ולהחזיר רשומת SOAP מובנית בעברית.

החזר JSON בלבד בפורמט הבא:
{
  "subjective": "תיאור הסימפטומים מנקודת המבט של המטופל, כולל כאב, תפקוד ומגבלות",
  "objective": "ממצאים אובייקטיביים — ROM, חוזק שרירים, בדיקות ספציפיות, תצפיות",
  "assessment": "הערכה קלינית של המטפל, התקדמות, אבחנה",
  "plan": "תוכנית הטיפול, תרגילים שנקבעו, תדירות, יעדים"
}

אם מידע חסר בתמלול, השאר את השדה ריק. אל תמציא מידע.`;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript } = await request.json();
  if (!transcript?.trim()) return Response.json({ error: "No transcript" }, { status: 400 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CL_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: `תמלול הטיפול:\n\n${transcript}` }],
    }),
  });

  if (!res.ok) {
    console.error("Claude error:", await res.text());
    return Response.json({ error: "SOAP generation failed" }, { status: 500 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const soap = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    return Response.json(soap);
  } catch {
    return Response.json({ subjective: text, objective: "", assessment: "", plan: "" });
  }
}
