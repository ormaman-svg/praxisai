// PATCH: update payment_link on an existing invoice
// Body: { payment_link: string }

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const { payment_link } = await request.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from("patient_invoices")
    .update({ stripe_payment_link: payment_link ?? null })
    .eq("id", params.id)
    .eq("clinic_id", clinicId);

  if (error) return Response.json({ error: "עדכון הקישור נכשל." }, { status: 500 });

  return Response.json({ ok: true });
}
