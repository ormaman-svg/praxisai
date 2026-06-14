// Create a patient invoice and (if Stripe is configured) a Payment Link.
// Flow: insert invoice → create Stripe Payment Link carrying metadata.invoice_id
//       → update invoice with the link URL. The Stripe webhook later reconciles
//       payment back to the invoice via that metadata.
// POST body: { patient_id, amount_ils, description, appointment_id? }

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

  const { patient_id, amount_ils, description, appointment_id } = await request.json();
  if (!patient_id || !amount_ils || Number(amount_ils) <= 0) {
    return Response.json({ error: "נדרשים: patient_id, amount_ils (> 0)." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Insert invoice first so we have an id for Stripe metadata.
  const { data: invoice, error } = await admin.from("patient_invoices").insert({
    clinic_id: clinicId,
    patient_id,
    appointment_id: appointment_id ?? null,
    amount_ils: Number(amount_ils),
    description: description ?? null,
    created_by: user.id,
  }).select().single();

  if (error || !invoice) return Response.json({ error: "יצירת החשבונית נכשלה." }, { status: 500 });

  // 2. If Stripe configured, create a Payment Link tagged with invoice_id.
  let stripePaymentLink: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const auth = `Bearer ${process.env.STRIPE_SECRET_KEY}`;
      const priceRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          unit_amount: String(Math.round(Number(amount_ils) * 100)),
          currency: "ils",
          "product_data[name]": description ?? "טיפול",
        }),
      });

      if (priceRes.ok) {
        const price = await priceRes.json();
        const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            "line_items[0][price]": price.id,
            "line_items[0][quantity]": "1",
            "metadata[clinic_id]": clinicId,
            "metadata[patient_id]": patient_id,
            "metadata[invoice_id]": invoice.id,
            // Propagate metadata onto the generated checkout session so the
            // checkout.session.completed webhook can reconcile to this invoice.
            "payment_intent_data[metadata][invoice_id]": invoice.id,
          }),
        });
        if (linkRes.ok) {
          stripePaymentLink = (await linkRes.json()).url;
          await admin
            .from("patient_invoices")
            .update({ stripe_payment_link: stripePaymentLink })
            .eq("id", invoice.id);
        } else {
          console.error("[patient-invoice] payment_links error:", await linkRes.text());
        }
      } else {
        console.error("[patient-invoice] prices error:", await priceRes.text());
      }
    } catch (e) {
      console.error("[patient-invoice] Stripe error:", e);
      // Non-fatal — invoice exists, just without an automatic link.
    }
  }

  return Response.json({ invoice: { ...invoice, stripe_payment_link: stripePaymentLink } });
}
