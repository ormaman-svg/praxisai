import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { isSuperAdminEmail } from "@/lib/super-admins";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://praxisai-one.vercel.app";

function ownerEmailHtml(clinicName: string, ownerName: string) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#0f1923 0%,#1a2e42 100%);border-radius:16px 16px 0 0;padding:32px 40px 28px;" align="right">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td><img src="${APP_URL}/logo.svg" alt="praxisAI" width="36" height="36" style="display:block;border:0;" /></td>
          <td style="padding-right:10px;"><span style="color:#fff;font-size:20px;font-weight:700;">praxisAI</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background-color:#fff;border:1px solid #e2e8f0;border-top:none;padding:44px 40px 36px;" align="right" dir="rtl">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">הקליניקה ${clinicName} נפתחה 🎉</h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#475569;">
          שלום ${ownerName}, נפתחה עבורך קליניקה חדשה ב‑praxisAI בשם <strong>${clinicName}</strong>, ואתה מוגדר כבעלים שלה.
          תוכל להיכנס עם כתובת המייל שלך ולהתחיל להזמין את הצוות.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:12px;background-color:#2563eb;">
            <a href="${APP_URL}/dashboard" style="display:inline-block;padding:15px 48px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">כניסה לקליניקה</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;" align="center">
        <p style="margin:0;font-size:12px;color:#94a3b8;">praxisAI — פלטפורמת AI קלינית לקליניקות פיזיותרפיה</p>
      </td></tr>
    </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isSuperAdminEmail(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, slug, ownerEmail } = await request.json();
  if (!name?.trim() || !ownerEmail?.trim()) {
    return Response.json({ error: "שם הקליניקה ומייל הבעלים הם שדות חובה." }, { status: 400 });
  }

  const admin = createAdminClient();
  const trimmedSlug = slug?.trim() || null;

  // Check for duplicate slug before inserting
  if (trimmedSlug) {
    const { data: existing } = await admin
      .from("clinics")
      .select("id")
      .eq("slug", trimmedSlug)
      .maybeSingle();
    if (existing) {
      return Response.json({ error: `קליניקה עם הכתובת "${trimmedSlug}" כבר קיימת — בחר כתובת אחרת.` }, { status: 409 });
    }
  }

  // Check for duplicate name
  const { data: existingName } = await admin
    .from("clinics")
    .select("id")
    .ilike("name", name.trim())
    .maybeSingle();
  if (existingName) {
    return Response.json({ error: `קליניקה בשם "${name.trim()}" כבר קיימת.` }, { status: 409 });
  }

  // Find owner by email
  const { data: users } = await admin.auth.admin.listUsers();
  const owner = users?.users?.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) {
    return Response.json({ error: `לא נמצא משתמש עם המייל ${ownerEmail} — יש ליצור אותו קודם ב-Supabase Auth.` }, { status: 404 });
  }

  // Create clinic
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .insert({ name: name.trim(), slug: trimmedSlug })
    .select("id")
    .single();

  if (clinicErr) {
    if (clinicErr.code === "23505") {
      return Response.json({ error: "קליניקה עם שם או כתובת זהים כבר קיימת." }, { status: 409 });
    }
    return Response.json({ error: clinicErr.message }, { status: 500 });
  }

  // Ensure profile exists
  await admin.from("profiles").upsert(
    { id: owner.id, full_name: owner.user_metadata?.full_name || ownerEmail },
    { onConflict: "id" }
  );

  // Add owner membership
  const { error: memberErr } = await admin.from("clinic_members").insert({
    clinic_id: clinic.id,
    user_id: owner.id,
    role: "owner",
  });

  if (memberErr) return Response.json({ error: memberErr.message }, { status: 500 });

  // Notify the owner that their clinic is ready.
  const ownerName = owner.user_metadata?.full_name || ownerEmail;
  const { sent } = await sendEmail(ownerEmail, `הקליניקה ${name.trim()} נפתחה — praxisAI`, ownerEmailHtml(name.trim(), ownerName));

  return Response.json({ ok: true, clinicId: clinic.id, ownerNotified: sent });
}

// Delete a clinic and all its data (cascade). Super admin only, and the
// caller must echo back the exact clinic name as a confirmation.
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isSuperAdminEmail(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clinicId, confirmName } = await request.json();
  if (!clinicId) return Response.json({ error: "חסר מזהה קליניקה." }, { status: 400 });

  const admin = createAdminClient();
  const { data: clinic } = await admin.from("clinics").select("name").eq("id", clinicId).single();
  if (!clinic) return Response.json({ error: "הקליניקה לא נמצאה." }, { status: 404 });

  if ((confirmName ?? "").trim() !== clinic.name.trim()) {
    return Response.json({ error: "שם האישור אינו תואם לשם הקליניקה." }, { status: 400 });
  }

  const { error } = await admin.from("clinics").delete().eq("id", clinicId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
