import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/super-admins";

const SECTION_COLORS = [
  { color: "bg-sky-500", ring: "focus-within:ring-sky-200" },
  { color: "bg-emerald-500", ring: "focus-within:ring-emerald-200" },
  { color: "bg-amber-500", ring: "focus-within:ring-amber-200" },
  { color: "bg-violet-500", ring: "focus-within:ring-violet-200" },
  { color: "bg-rose-500", ring: "focus-within:ring-rose-200" },
  { color: "bg-indigo-500", ring: "focus-within:ring-indigo-200" },
];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: "רק מנהל המערכת יכול לשנות את תבנית התיעוד." }, { status: 403 });
  }

  if (!process.env.CL_KEY) return NextResponse.json({ error: "CL_KEY חסר" }, { status: 500 });

  const { sample } = await req.json();
  if (!sample?.trim()) return NextResponse.json({ error: "No sample" }, { status: 400 });

  const systemPrompt = `אתה מומחה לתיעוד קליני פיזיותרפי. קיבלת רשומת טיפול לדוגמה.
נתח את המבנה שלה וזהה את הסעיפים העיקריים.

החזר JSON בלבד בפורמט:
{
  "name": "שם קצר לתבנית (עברית)",
  "systemContext": "הנחיות קצרות לשפה ומינוח מקצועי לשימוש ב-AI (עברית, 1-2 משפטים)",
  "sections": [
    {
      "key": "snake_case_key",
      "label": "כותרת הסעיף בעברית",
      "letter": "1-2 אותיות",
      "placeholder": "מה כוללת הקטגוריה (עברית, קצר)",
      "guidance": "הנחיה ל-AI על מה לכלול בסעיף זה (עברית)"
    }
  ]
}

כללים:
- זהה 3-6 סעיפים מרכזיים
- מפתחות (key) ב-snake_case אנגלית בלבד
- letters: ראשי תיבות או אות אחת לזיהוי
- החזר JSON בלבד, ללא הסבר`;

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
      system: systemPrompt,
      messages: [{ role: "user", content: `רשומה לדוגמה:\n\n${sample}` }],
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "ניתוח נכשל" }, { status: 500 });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    // Inject color/ring pairs
    const sections = (parsed.sections ?? []).map((s: any, i: number) => ({
      ...s,
      color: SECTION_COLORS[i % SECTION_COLORS.length].color,
      ring: SECTION_COLORS[i % SECTION_COLORS.length].ring,
    }));
    return NextResponse.json({ template: { ...parsed, id: "custom", icon: "📋", description: "תבנית מותאמת אישית", sections } });
  } catch {
    return NextResponse.json({ error: "הניתוח לא הצליח לזהות מבנה תקין" }, { status: 422 });
  }
}
