// Disconnects (logs out) a clinic's active WhatsApp number from the Evolution
// instance. The instance itself is kept — a fresh QR can be scanned afterwards
// to connect a different number. Owner/admin only.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { logoutInstance, setWebhook } from "@/lib/whatsapp/evolution-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clinicIdParam = url.searchParams.get("clinic_id");

  let clinicId = clinicIdParam ?? getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id, role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!m || !["owner", "admin"].includes(m.role)) {
      return Response.json({ error: "אין הרשאה" }, { status: 403 });
    }
    clinicId = m.clinic_id;
  } else {
    const { data: m } = await supabase
      .from("clinic_members").select("role")
      .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
    if (!m || !["owner", "admin"].includes(m.role)) {
      return Response.json({ error: "אין הרשאה" }, { status: 403 });
    }
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

  function appOrigin(req: Request): string {
    const h = req.headers;
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
    const env = process.env.NEXT_PUBLIC_APP_URL;
    if (env) return env.replace(/\/$/, "");
    return new URL(req.url).origin;
  }

  const creds = { host, apiKey, instance };
  try {
    // Re-register the webhook BEFORE logging out so Evolution knows where to
    // send the next CONNECTION_UPDATE event when a new QR is scanned.
    await setWebhook(creds, `${appOrigin(request)}/api/whatsapp/evolution`).catch(() => {});
    await logoutInstance(creds);
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[evolution/disconnect]", e);
    return Response.json({ error: e?.message ?? "הניתוק נכשל" }, { status: 502 });
  }
}
