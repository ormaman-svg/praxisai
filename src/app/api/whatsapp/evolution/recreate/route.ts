// Deletes the existing Evolution instance and recreates it with correct params
// (qrcode: true, integration: WHATSAPP-BAILEYS). Called when the instance is stuck
// returning { count: 0 } from /instance/connect because it was created without those params.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { deleteInstance, createInstance } from "@/lib/whatsapp/evolution-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  } else {
    const { data: m } = await supabase
      .from("clinic_members").select("role")
      .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
    if (!m || !["owner", "admin"].includes(m.role))
      return Response.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { globalApiKey } = await request.json().catch(() => ({}));
  if (!globalApiKey?.trim())
    return Response.json({ error: "יש להזין Global API Key." }, { status: 400 });

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("settings").eq("id", clinicId).single();
  const s = (clinic?.settings ?? {}) as Record<string, string>;

  const host = s.evolution_host;
  const instance = s.evolution_instance;

  if (!host || !instance)
    return Response.json({ error: "Evolution API לא מוגדר." }, { status: 400 });

  const gKey = globalApiKey.trim();

  try {
    // 1. Delete old instance (ignore errors — might not exist)
    await deleteInstance(host, gKey, instance);
    await new Promise((res) => setTimeout(res, 1500));

    // 2. Recreate with correct params. In v2 the QR comes back in THIS response.
    const { apikey: newKey, qrBase64 } = await createInstance(host, gKey, instance);
    console.log("[evolution/recreate] key length:", newKey?.length ?? 0, "hasQr:", !!qrBase64);
    if (!newKey)
      return Response.json({ error: "יצירת Instance נכשלה — בדוק את ה-Global API Key." }, { status: 502 });

    // 3. Persist the new instance API key
    await admin.from("clinics")
      .update({ settings: { ...s, evolution_api_key: newKey } })
      .eq("id", clinicId);

    // 4. Return the QR from the create response. If it wasn't included, the
    //    client falls back to polling /qr.
    return Response.json({ ok: true, qrBase64: qrBase64 ?? null });
  } catch (e: any) {
    console.error("[evolution/recreate]", e);
    return Response.json({ error: e?.message ?? "שגיאה ביצירת Instance" }, { status: 502 });
  }
}
