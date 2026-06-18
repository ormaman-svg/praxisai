// Returns the current QR code + connection state for a clinic's Evolution API instance.
// Used by the WhatsApp settings UI to display the QR code for scanning.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { getConnectionState, getQrCode, restartInstance, logoutInstance } from "@/lib/whatsapp/evolution-api";

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

  const creds = { host, apiKey, instance };
  try {
    let state = await getConnectionState(creds);
    if (state === "open") {
      return Response.json({ state, qrBase64: null });
    }

    let qr = await getQrCode(creds);

    // If the instance is stuck without a QR (Evolution returns { count: 0 }),
    // it's trying to resume a stale session. Clear it, restart, and retry so a
    // fresh QR is generated.
    if (!qr.base64) {
      await logoutInstance(creds);
      await new Promise((res) => setTimeout(res, 1500));
      await restartInstance(creds);
      await new Promise((res) => setTimeout(res, 2500));
      qr = await getQrCode(creds);
      state = await getConnectionState(creds);
    }

    return Response.json({
      state,
      qrBase64: qr.base64,
      // Surfaced only when no QR was produced, to aid debugging from the UI.
      debug: qr.base64 ? undefined : { status: qr.status, raw: qr.raw },
    });
  } catch (e: any) {
    console.error("[evolution/qr]", e);
    return Response.json({ error: e?.message ?? "שגיאה בטעינת QR" }, { status: 502 });
  }
}
