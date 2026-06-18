// Called after saving Evolution credentials — auto-configures the webhook in Evolution API
// so the user never needs to run curl commands manually.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m || !["owner", "admin"].includes(m.role))
      return Response.json({ error: "אין הרשאה" }, { status: 403 });
    clinicId = m.clinic_id;
  }

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
  const s = (clinic?.settings ?? {}) as Record<string, string>;

  const host = s.evolution_host;
  const instance = s.evolution_instance;
  const apiKey = s.evolution_api_key;

  if (!host || !instance || !apiKey) {
    return Response.json({ error: "Evolution API לא מוגדר." }, { status: 400 });
  }

  const { origin } = await request.json().catch(() => ({ origin: "" }));
  const webhookUrl = `${origin}/api/whatsapp/evolution`;

  // Configure webhook in Evolution API v2 format
  const r = await fetch(`${host}/webhook/set/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    console.error("[evolution/setup] webhook set failed:", r.status, text);
    return Response.json({ error: `הגדרת Webhook נכשלה (${r.status}). בדוק שה-URL וה-API Key נכונים.` }, { status: 502 });
  }

  return Response.json({ ok: true, webhookUrl });
}
