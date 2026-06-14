// Stripe webhook — reconciles completed payments back to patient_invoices.
// Configure the endpoint in Stripe Dashboard pointing here, listening for
// checkout.session.completed. Set STRIPE_WEBHOOK_SECRET to the signing secret.

import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Verify Stripe's signature header: "t=<ts>,v1=<sig>".
// Signed payload is `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook secret.
function verifyStripe(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  // Reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const header = request.headers.get("stripe-signature") ?? "";

  if (secret) {
    if (!verifyStripe(rawBody, header, secret)) {
      return new Response("Invalid signature", { status: 400 });
    }
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = (session.metadata ?? {}) as Record<string, string>;
    const invoiceId = metadata.invoice_id;
    const paid = session.payment_status === "paid";

    if (invoiceId && paid) {
      const admin = createAdminClient();
      await admin
        .from("patient_invoices")
        .update({
          status: "paid",
          stripe_session_id: session.id as string,
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("status", "pending"); // idempotent — only the first event flips it
    }
  }

  return Response.json({ received: true });
}
