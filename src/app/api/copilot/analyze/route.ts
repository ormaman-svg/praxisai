import { createClient } from "@/lib/supabase/server";
import { invoke } from "@/lib/ai/invoke";

export const maxDuration = 30;

// POST /api/copilot/analyze
// Body: { patient_id: string; force?: boolean }
// Returns cached or freshly generated clinical insights.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const patientId: string = body?.patient_id;
  const force: boolean = body?.force ?? false;

  if (!patientId) return new Response("Bad Request", { status: 400 });

  // Load patient
  const { data: patient } = await supabase
    .from("patients")
    .select("id, clinic_id, first_name, last_name, dob, diagnosis, kupah, referral_source, bituach_leumi_case")
    .eq("id", patientId)
    .single();

  if (!patient) return new Response("Not found", { status: 404 });

  // Verify membership
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", patient.clinic_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return new Response("Forbidden", { status: 403 });

  // Load treatments
  const { data: treatments } = await supabase
    .from("treatments")
    .select("id, treated_at, type, vas, subjective, objective, assessment, plan, note")
    .eq("patient_id", patientId)
    .order("treated_at", { ascending: true });

  const treatmentCount = treatments?.length ?? 0;

  // Check cache (skip if force=true or treatment count changed)
  if (!force) {
    const { data: cached } = await supabase
      .from("copilot_insights")
      .select("flags, suggestions, generated_at, treatment_count")
      .eq("patient_id", patientId)
      .maybeSingle();

    if (cached && cached.treatment_count === treatmentCount) {
      return Response.json({
        flags: cached.flags ?? [],
        suggestions: cached.suggestions ?? [],
        generated_at: cached.generated_at,
        cached: true,
      });
    }
  }

  // Load supporting data for context
  const [{ data: measurements }, { data: hepLogs }, { data: invoices }] = await Promise.all([
    supabase.from("measurements").select("kind, joint, movement, value, unit, recorded_at, scale_label")
      .eq("patient_id", patientId).order("recorded_at", { ascending: true }),
    supabase.from("hep_logs").select("logged_at, completed, pain_score")
      .eq("patient_id", patientId).order("logged_at", { ascending: false }).limit(30),
    supabase.from("patient_invoices").select("amount_ils, status, created_at")
      .eq("patient_id", patientId).eq("status", "pending"),
  ]);

  // Build clinical summary for AI
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / 3.15576e10)
    : null;

  const vasTrend = (treatments ?? [])
    .filter((t) => t.vas !== null)
    .map((t) => `${new Date(t.treated_at).toLocaleDateString("he-IL")}: ${t.vas}/10`);

  const romSummary = (measurements ?? [])
    .filter((m) => m.kind === "ROM")
    .slice(-6)
    .map((m) => `${m.joint} ${m.movement}: ${m.value}${m.unit ?? "deg"}`);

  const promSummary = (measurements ?? [])
    .filter((m) => m.kind === "PROM")
    .map((m) => `${m.scale_label ?? "PROM"} ${new Date(m.recorded_at).toLocaleDateString("he-IL")}: ${m.value}`);

  const hepAdherence = hepLogs
    ? `${hepLogs.filter((l) => l.completed).length}/${hepLogs.length} ביצועי HEP (${hepLogs.length} האחרונים)`
    : "לא ידוע";

  const lastNotes = (treatments ?? []).slice(-3).map((t) => {
    const sections = t.note?.sections?.map((s: any) => `${s.letter}: ${s.content}`).join(". ") ??
      [t.subjective, t.objective, t.assessment, t.plan].filter(Boolean).join(". ");
    return `${new Date(t.treated_at).toLocaleDateString("he-IL")} (${t.type}): ${sections}`;
  });

  const systemPrompt = `אתה עוזר AI קליני לפיזיותרפיסטים ומטפלים בישראל.
מטרתך לנתח נתוני מטופל ולספק:
1. התראות קליניות (דגלים אדומים, עצירת התקדמות, ציות לטיפול)
2. המלצות מבוססות עדות לשיפור הטיפול

כללים חשובים:
- אל תאבחן ואל תחליף שיקול דעת קליני
- התמקד בדפוסים, חריגות, ומה שעשוי לדרוש תשומת לב
- ציין רמת עדות לכל המלצה (high/moderate/low/expert)
- השב בעברית, בפורמט JSON בלבד

פורמט תגובה נדרש (JSON בלבד, ללא טקסט נוסף):
{
  "flags": [
    {"type": "red_flag|plateau|adherence|info", "severity": "high|medium|low", "message_he": "..."}
  ],
  "suggestions": [
    {"title_he": "...", "body_he": "...", "evidence_level": "high|moderate|low|expert"}
  ]
}`;

  const userMessage = `נתוני מטופל לניתוח:

גיל: ${age ?? "לא ידוע"}
אבחנה: ${patient.diagnosis ?? "לא מצוין"}
קופת חולים: ${patient.kupah ?? "לא ידוע"}
מקור הפניה: ${patient.referral_source ?? "לא ידוע"}
בטיפול ביטוח לאומי: ${patient.bituach_leumi_case ? "כן" : "לא"}

מספר טיפולים: ${treatmentCount}
${vasTrend.length > 0 ? `מגמת כאב (VAS):\n${vasTrend.join("\n")}` : "אין מדידות VAS"}
${romSummary.length > 0 ? `\nמדידות ROM אחרונות:\n${romSummary.join("\n")}` : ""}
${promSummary.length > 0 ? `\nמדידות PROM:\n${promSummary.join("\n")}` : ""}

ציות לתרגילי בית: ${hepAdherence}
${invoices && invoices.length > 0 ? `חשבוניות פתוחות: ${invoices.length}` : ""}

תיעוד 3 הטיפולים האחרונים:
${lastNotes.join("\n\n")}

נתח ותן פלט JSON בלבד.`;

  let flags: any[] = [];
  let suggestions: any[] = [];

  try {
    const result = await invoke({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 1500,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 8) : [];
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : [];
    }
  } catch {
    // Return empty insights rather than erroring
  }

  const now = new Date().toISOString();

  // Upsert cache
  await supabase.from("copilot_insights").upsert({
    clinic_id: patient.clinic_id,
    patient_id: patientId,
    treatment_count: treatmentCount,
    flags,
    suggestions,
    generated_at: now,
  }, { onConflict: "patient_id" });

  return Response.json({ flags, suggestions, generated_at: now, cached: false });
}
