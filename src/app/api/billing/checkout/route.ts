import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";

const VALID_PLANS = ["free", "pro", "clinic"] as const;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = await request.json();
  if (!VALID_PLANS.includes(plan)) {
    return Response.json({ error: "תוכנית לא מוכרת." }, { status: 400 });
  }

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return Response.json({ error: "אין קליניקה פעילה." }, { status: 400 });

  // Only owner/admin can change billing
  const { data: membership } = await supabase
    .from("clinic_members").select("role")
    .eq("clinic_id", clinicId).eq("user_id", user.id).eq("status", "active").single();
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return Response.json({ error: "רק מנהל קליניקה יכול לשנות את המנוי." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { count: seats } = await admin
    .from("clinic_members").select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId).eq("status", "active");

  // When Stripe is configured → real checkout session; otherwise activate as trial.
  if (process.env.STRIPE_SECRET_KEY && plan !== "free") {
    const priceId = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_CLINIC;
    if (!priceId) {
      return Response.json({ error: "מחיר Stripe לא מוגדר (STRIPE_PRICE_*)." }, { status: 500 });
    }
    const origin = new URL(request.url).origin;
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": String(Math.max(seats ?? 1, 1)),
      success_url: `${origin}/settings/billing?status=success`,
      cancel_url: `${origin}/settings/billing?status=cancel`,
      "metadata[clinic_id]": clinicId,
      "metadata[plan]": plan,
      customer_email: user.email ?? "",
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      console.error("Stripe error:", await res.text());
      return Response.json({ error: "יצירת עמוד התשלום נכשלה." }, { status: 500 });
    }
    const session = await res.json();
    return Response.json({ checkout_url: session.url });
  }

  // No Stripe configured (or downgrade to free) — update the plan directly.
  const trialEnd = new Date(Date.now() + 30 * 864e5).toISOString();
  const { error } = await admin.from("subscriptions").upsert({
    clinic_id: clinicId,
    plan,
    status: plan === "free" ? "active" : "trial",
    seats: seats ?? 1,
    current_period_end: plan === "free" ? null : trialEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: "clinic_id" });

  if (error) return Response.json({ error: "עדכון המנוי נכשל." }, { status: 500 });

  return Response.json({
    message: plan === "free"
      ? "עברתם לתוכנית החינמית."
      : "התוכנית הופעלה ב־30 ימי ניסיון חינם — החיוב יופעל עם חיבור Stripe.",
  });
}
