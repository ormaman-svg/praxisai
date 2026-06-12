import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { DOC_TYPE_HE, TREATMENT_TYPE_HE, type Treatment, type TreatmentNote } from "@/lib/types";

const DOC_GUIDANCE: Record<string, string> = {
  bituach_leumi: "מכתב רשמי לביטוח לאומי: פרטי המטופל, אבחנה, מהלך הטיפול עד כה, מצב תפקודי נוכחי, מגבלות, והמלצות להמשך. שפה רשמית ומקצועית המתאימה למוסד לביטוח לאומי.",
  referral: "מכתב הפניה לרופא/מומחה: סיבת ההפניה, ממצאים קליניים עיקריים, טיפולים שבוצעו ותגובת המטופל, ושאלה קלינית ממוקדת למומחה.",
  status_report: "דו\"ח התקדמות: מצב בתחילת הטיפול, מהלך הטיפול, מדדים אובייקטיביים (כולל מגמת VAS), מצב נוכחי ביחס ליעדים, ותוכנית המשך.",
  discharge_summary: "סיכום שחרור: סיבת פנייה, מהלך הטיפול המלא, מצב בקבלה לעומת מצב בשחרור, יעדים שהושגו, הנחיות להמשך עצמאי והמלצות.",
  insurance: "מסמך לתביעת ביטוח: תיאור הפגיעה/המצב, הטיפולים שניתנו ותאריכיהם, מצב נוכחי, צפי להמשך טיפול והשלכות תפקודיות.",
  sick_leave: "אישור מנוחה/מחלה קצר ורשמי: שם המטופל, האבחנה, ההמלצה לתקופת מנוחה והגבלות פעילות.",
};

function noteText(t: Treatment): string {
  const note = t.note as TreatmentNote | null;
  if (note?.sections?.length) {
    return note.sections.map((s) => `${s.label}: ${s.content}`).join("\n");
  }
  return [
    t.subjective && `S: ${t.subjective}`,
    t.objective && `O: ${t.objective}`,
    t.assessment && `A: ${t.assessment}`,
    t.plan && `P: ${t.plan}`,
  ].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.CL_KEY) {
    return Response.json({ error: "CL_KEY חסר בהגדרות הסביבה." }, { status: 500 });
  }

  const { patientId, type } = await request.json();
  if (!patientId || !DOC_GUIDANCE[type]) {
    return Response.json({ error: "חסר מטופל או סוג מסמך." }, { status: 400 });
  }

  const clinicId = await resolveClinicId(supabase, user.id);
  const [{ data: patient }, { data: treatments }, { data: clinic }, { data: profile }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).single(),
    supabase.from("treatments")
      .select("*").eq("patient_id", patientId)
      .order("treated_at", { ascending: false }).limit(12),
    clinicId ? supabase.from("clinics").select("name").eq("id", clinicId).single() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  if (!patient) return Response.json({ error: "מטופל לא נמצא." }, { status: 404 });

  const template = await getClinicTemplate(supabase, clinicId);
  const tx = (treatments ?? []) as Treatment[];
  const history = tx.slice().reverse().map((t) => {
    const date = new Date(t.treated_at).toLocaleDateString("he-IL");
    const vas = t.vas !== null ? ` (VAS ${t.vas})` : "";
    return `--- ${date} · ${TREATMENT_TYPE_HE[t.type] ?? t.type}${vas} ---\n${noteText(t)}`;
  }).join("\n\n");

  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 864e5))
    : null;

  const system = `אתה עוזר קליני לאנשי מקצוע בתחום הבריאות בישראל, המנסח מסמכים רפואיים רשמיים בעברית.
תחום הקליניקה: ${template.profession} (${template.name}).
${template.systemContext}

סוג המסמך המבוקש: ${DOC_TYPE_HE[type]}.
הנחיות: ${DOC_GUIDANCE[type]}

כללים:
- כתוב בעברית רשמית ומקצועית, מבנה ברור עם פסקאות
- בסס את התוכן אך ורק על נתוני המטופל והטיפולים שסופקו — אל תמציא ממצאים
- אם חסר מידע מהותי, ציין [להשלמה: ___] במקום להמציא
- אל תכלול תאריך, לוגו או חתימה — אלו מתווספים בנפרד
- החזר JSON בלבד: {"title": "כותרת קצרה למסמך", "content": "גוף המסמך המלא"}`;

  const userMsg = `פרטי המטופל:
שם: ${patient.first_name} ${patient.last_name}
${patient.national_id ? `ת.ז.: ${patient.national_id}` : ""}
${age !== null ? `גיל: ${age}` : ""}
${patient.kupah ? `קופת חולים: ${patient.kupah}` : ""}
${patient.diagnosis ? `אבחנה: ${patient.diagnosis}` : ""}
קליניקה: ${clinic?.name ?? ""}
מטפל/ת: ${profile?.full_name ?? ""}

היסטוריית טיפולים (${tx.length} אחרונים):
${history || "אין תיעוד טיפולים עדיין."}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CL_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    console.error("Claude error:", await res.text());
    return Response.json({ error: "יצירת המסמך נכשלה." }, { status: 500 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  try {
    const doc = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    if (!doc.content) throw new Error("empty");
    return Response.json({ title: doc.title ?? DOC_TYPE_HE[type], content: doc.content });
  } catch {
    return Response.json({ title: DOC_TYPE_HE[type], content: text });
  }
}
