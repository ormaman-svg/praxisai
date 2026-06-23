// Returns the current QR code + connection state for a clinic's Evolution API instance.
// Used by the WhatsApp settings UI to display the QR code for scanning.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { getConnectionState, getQrCode, restartInstance, logoutInstance, setWebhook } from "@/lib/whatsapp/evolution-api";

// Derives the public app origin so Evolution can reach our webhook, even when
// the request hits an internal Vercel URL.
function appOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
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
    return Response.json({ error: "Evolution API לא מוגדר עדיין." }, { status: 400 });
  }

  // ?reset=1 clears a stuck session (Evolution returns { count: 0 } when it's
  // trying to resume a stale session instead of emitting a fresh QR). The reset
  // must happen ONCE; afterwards the client polls the plain endpoint so Baileys
  // has time to emit the QR. Resetting on every poll would loop forever.
  const reset = url.searchParams.get("reset") === "1";

  const creds = { host, apiKey, instance };
  // Always (re)register the webhook on every poll so Evolution knows our URL
  // regardless of whether the settings page was open when the phone connected.
  // This is idempotent and cheap — it ensures self-healing after any reconnect.
  const webhookUrl = `${appOrigin(request)}/api/whatsapp/evolution`;
  setWebhook(creds, webhookUrl).catch(() => {}); // fire-and-forget, don't block

  try {
    const state = await getConnectionState(creds);
    if (state === "open") {
      return Response.json({ state, qrBase64: null });
    }

    if (reset) {
      await logoutInstance(creds);
      await new Promise((res) => setTimeout(res, 1500));
      await restartInstance(creds);
      // Give Baileys a moment to spin up before the first connect attempt.
      await new Promise((res) => setTimeout(res, 3000));
    }

    const qr = await getQrCode(creds);
    const stateAfter = await getConnectionState(creds);

    // If Baileys returned no QR and state is still "close", the process is
    // stuck (e.g. after a Railway restart or trial expiry). Auto-restart the
    // instance so the next poll gets a fresh QR — no manual redeploy needed.
    if (!qr.base64 && stateAfter === "close" && !reset) {
      console.log("[evolution/qr] no QR + state=close — auto-restarting instance");
      await restartInstance(creds).catch(() => {});
    }

    return Response.json({
      state: stateAfter,
      qrBase64: qr.base64,
      debug: qr.base64 ? undefined : { status: qr.status, raw: qr.raw },
    });
  } catch (e: any) {
    console.error("[evolution/qr]", e);
    return Response.json({ error: e?.message ?? "שגיאה בטעינת QR" }, { status: 502 });
  }
}
