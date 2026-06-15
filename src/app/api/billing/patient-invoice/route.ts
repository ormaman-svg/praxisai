// Create a patient invoice.
// POST body: { patient_id, amount_ils, description?, appointment_id?, payment_link? }
// payment_link: optional URL from any payment provider (Meshulam, Tranzila, iCount, etc.)

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return Response.json({ error: "אין קליניקה פעילה." }, { status: 400 });

  const { data: membership } = await supabase
    .from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
  if (!["owner", "admin", "therapist"].includes(membership?.role ?? "")) {
    return Response.json({ error: "אין הרשאה ליצור חשבוניות." }, { status: 403 });
  }

  const { patient_id, amount_ils, description, appointment_id, payment_link } = await request.json();
  if (!patient_id || !amount_ils || Number(amount_ils) <= 0) {
    return Response.json({ error: "נדרשים: patient_id, amount_ils (> 0)." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: invoice, error } = await admin.from("patient_invoices").insert({
    clinic_id: clinicId,
    patient_id,
    appointment_id: appointment_id ?? null,
    amount_ils: Number(amount_ils),
    description: description ?? null,
    stripe_payment_link: payment_link ?? null,
    created_by: user.id,
  }).select().single();

  if (error || !invoice) return Response.json({ error: "יצירת החשבונית נכשלה." }, { status: 500 });

  return Response.json({ invoice });
}
