import { createClient } from "@/lib/supabase/server";

// Print-ready (HTML→PDF via browser print) rendering of a patient invoice.
// GET /api/billing/patient-invoice/export?id=<uuid>&print=1
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Bad Request", { status: 400 });

  const { data: inv, error } = await supabase
    .from("patient_invoices")
    .select(`
      id, clinic_id, amount_ils, description, status, stripe_payment_link,
      created_at, paid_at,
      patients(first_name, last_name, phone),
      clinics(name)
    `)
    .eq("id", id)
    .single();

  if (error || !inv) return new Response("Not found", { status: 404 });

  // Verify caller is an active member of the invoice's clinic.
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", inv.clinic_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return new Response("Forbidden", { status: 403 });

  const patient = inv.patients as any;
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "—";
  const clinicName = (inv.clinics as any)?.name ?? "";
  const dateStr = new Date(inv.created_at).toLocaleDateString("he-IL");
  const invNo = (inv.id as string).slice(0, 8).toUpperCase();
  const amount = Number(inv.amount_ils);
  const statusHe = inv.status === "paid" ? "שולם" : inv.status === "cancelled" ? "בוטל" : "ממתין לתשלום";
  const statusColor = inv.status === "paid" ? "#059669" : inv.status === "cancelled" ? "#94a3b8" : "#d97706";
  const paidStr = inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("he-IL") : "";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>חשבונית ${invNo}</title>
<style>
  @page { margin: 2cm; }
  body {
    font-family: Arial, "Noto Sans Hebrew", sans-serif;
    color: #1a1a2e; direction: rtl; unicode-bidi: embed;
    margin: 0; padding: 0; font-size: 12pt;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;
  }
  .clinic-name { font-size: 16pt; font-weight: bold; color: #1e293b; }
  .doc-title { font-size: 22pt; font-weight: bold; color: #7c3aed; }
  .doc-no { font-size: 9.5pt; color: #64748b; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 28px; }
  .label { font-size: 9pt; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }
  .value { font-size: 11.5pt; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: right; font-size: 9.5pt; color: #64748b; border-bottom: 1.5px solid #e2e8f0; padding: 8px 6px; }
  td { font-size: 11.5pt; padding: 12px 6px; border-bottom: 1px solid #f1f5f9; }
  .total-box { margin-top: 24px; display: flex; justify-content: flex-start; }
  .total {
    background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px;
    padding: 14px 22px; min-width: 220px;
  }
  .total .label { color: #6d28d9; }
  .total .amount { font-size: 20pt; font-weight: bold; color: #5b21b6; }
  .status-pill {
    display: inline-block; padding: 4px 12px; border-radius: 99px;
    font-size: 10pt; font-weight: bold; color: #fff; background: ${statusColor};
  }
  .pay-link { margin-top: 24px; font-size: 10.5pt; }
  .pay-link a { color: #7c3aed; }
  .footer {
    margin-top: 48px; font-size: 9pt; color: #94a3b8;
    border-top: 1px solid #e2e8f0; padding-top: 12px;
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="clinic-name">${escapeHtml(clinicName)}</div>
    <div class="doc-no">מס׳ חשבונית: ${invNo}</div>
  </div>
  <div style="text-align:left;">
    <div class="doc-title">חשבונית</div>
    <div class="doc-no">תאריך: ${dateStr}</div>
  </div>
</div>

<div class="row">
  <div>
    <div class="label">לכבוד</div>
    <div class="value">${escapeHtml(patientName)}</div>
    ${patient?.phone ? `<div class="value" dir="ltr" style="color:#64748b;font-size:10pt;">${escapeHtml(patient.phone)}</div>` : ""}
  </div>
  <div style="text-align:left;">
    <div class="label">סטטוס</div>
    <div><span class="status-pill">${statusHe}</span></div>
    ${paidStr ? `<div class="value" style="color:#64748b;font-size:9.5pt;margin-top:4px;">שולם בתאריך ${paidStr}</div>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr><th>תיאור</th><th style="text-align:left;">סכום</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>${escapeHtml(inv.description ?? "טיפול")}</td>
      <td style="text-align:left;">${amount.toLocaleString("he-IL")} ₪</td>
    </tr>
  </tbody>
</table>

<div class="total-box">
  <div class="total">
    <div class="label">סה״כ לתשלום</div>
    <div class="amount">${amount.toLocaleString("he-IL")} ₪</div>
  </div>
</div>

${inv.stripe_payment_link ? `<div class="pay-link">לתשלום מקוון: <a href="${escapeAttr(inv.stripe_payment_link)}">${escapeHtml(inv.stripe_payment_link)}</a></div>` : ""}

<div class="footer">הופק על ידי praxisAI &middot; ${new Date().toLocaleDateString("he-IL")}</div>
${searchParams.get("print") === "1" ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},350);});</script>` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
