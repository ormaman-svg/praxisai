import { createClient } from "@/lib/supabase/server";
import { resolveClinicId, getClinicTemplate } from "@/lib/clinic-template-server";
import { buildSoapPrompt } from "@/lib/clinic-templates";

export const maxDuration = 60; // structured extraction over many fields can take a while

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.CL_KEY) {
    return Response.json({ error: "CL_KEY חסר בהגדרות הסביבה של Vercel." }, { status: 500 });
  }

  const { transcript } = await request.json();
  if (!transcript?.trim()) return Response.json({ error: "No transcript" }, { status: 400 });

  const clinicId = await resolveClinicId(supabase, user.id);
  const template = await getClinicTemplate(supabase, clinicId);
  const systemPrompt = buildSoapPrompt(template);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CL_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3072,
      system: systemPrompt,
      messages: [{ role: "user", content: `תמלול הטיפול:\n\n${transcript}` }],
    }),
  });

  if (!res.ok) {
    console.error("Claude error:", await res.text());
    return Response.json({ error: "יצירת הרשומה נכשלה." }, { status: 500 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const note = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    return Response.json({ ...note, _template_id: template.id });
  } catch {
    const fallback: Record<string, string> = { _template_id: template.id };
    if (template.sections[0]) fallback[template.sections[0].key] = text;
    return Response.json(fallback);
  }
}
