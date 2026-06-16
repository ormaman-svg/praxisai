// Generate a home-program (HEP) from free text (e.g. a treatment plan) using the
// provider-agnostic AI layer, tailored to the clinic's profession.
// Returns { title, items: [...] }.

import { createClient } from "@/lib/supabase/server";
import { invoke } from "@/lib/ai/invoke";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { getHomeProgramConfig, type HomeProgramConfig } from "@/lib/clinic-templates";
import { enrichWithVideos } from "@/lib/youtube/search";

function buildSystem(cfg: HomeProgramConfig): string {
  if (cfg.showSetsReps) {
    return `${cfg.aiRole}. המשתמש ייתן לך תיאור חופשי של תוכנית טיפול / המלצות.
החזר אך ורק JSON תקין במבנה הבא, ללא טקסט נוסף:
{"title":"שם התוכנית","items":[{"name":"שם הפריט","english_name":"clinical English name","sets":3,"reps":10,"hold_sec":0,"frequency":"daily","description":"תיאור קצר של אופן הביצוע"}]}
כללים: 3-6 ${cfg.aiItemNoun}, שמות בעברית, english_name — שם קליני מדויק באנגלית לחיפוש וידאו הדגמה (לדוגמה: "supine knee flexion"), description — משפט אחד על אופן הביצוע, frequency אחד מ: daily / 2x_daily / alternate_days.`;
  }
  return `${cfg.aiRole}. המשתמש ייתן לך תיאור חופשי של תוכנית טיפול / המלצות.
החזר אך ורק JSON תקין במבנה הבא, ללא טקסט נוסף:
{"title":"שם התוכנית","items":[{"name":"שם הפריט","sets":null,"reps":null,"hold_sec":null,"frequency":"daily","description":"הסבר קצר על אופן התרגול/הביצוע"}]}
כללים: 3-6 ${cfg.aiItemNoun}, שמות בעברית, description — משפט-שניים על אופן הביצוע, frequency אחד מ: daily / 2x_daily / alternate_days. אל תכלול סטים או חזרות.`;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await request.json();
  if (!source?.trim()) return Response.json({ error: "חסר טקסט מקור." }, { status: 400 });

  // Tailor generation to the clinic's profession.
  const clinicId = await resolveClinicId(supabase, user.id);
  const template = await getClinicTemplate(supabase, clinicId);
  const config = getHomeProgramConfig(template.profession);
  if (!config) {
    return Response.json({ error: "תוכנית תרגול אינה רלוונטית לסוג קליניקה זה." }, { status: 400 });
  }

  try {
    const result = await invoke({
      system: buildSystem(config),
      messages: [{ role: "user", content: source.trim() }],
      maxTokens: 1000,
    });

    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "ה-AI לא החזיר תוכנית תקינה." }, { status: 502 });
    const parsed = JSON.parse(match[0]) as {
      title: string;
      items: { name: string; english_name?: string; video_url?: string }[];
    };

    // Attach demonstration videos only for professions where it's relevant
    // (physical exercises), using the clinical English name for accuracy.
    if (config.showVideo) {
      parsed.items = await enrichWithVideos(parsed.items);
    }

    return Response.json(parsed);
  } catch (e) {
    console.error("[hep/generate] error:", e);
    return Response.json({ error: "יצירת התוכנית נכשלה." }, { status: 500 });
  }
}
