import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteEmailHtml } from "@/lib/email/invite-template";
import { sendEmail } from "@/lib/email/send";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";
import { ROLE_HE, type MemberRole } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function requireAdmin(clinicId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // Super admin may manage any clinic.
  if (user.email === SUPER_ADMIN_EMAIL) return user;
  const { data: member } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!member || !["owner", "admin"].includes(member.role)) return null;
  return user;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM ?? "praxisAI <onboarding@resend.dev>";
      const { error: sendErr } = await resend.emails.send({ from, to, subject, html });
      if (!sendErr) return { sent: true };
      console.error("[Resend] send error:", JSON.stringify(sendErr));
    } catch (e) {
      console.error("[Resend] exception:", e);
    }
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      await transporter.sendMail({
        from: `"praxisAI" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        headers: {
          "X-Mailer": "praxisAI",
          "X-Entity-Ref-ID": Date.now().toString(),
          "List-Unsubscribe": `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`,
        },
      });
      console.log("[Gmail] sent ok to:", to);
      return { sent: true };
    } catch (e) {
      console.error("[Gmail] exception:", e);
    }
  }

  return { sent: false };
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY חסר בהגדרות הסביבה של Vercel." }, { status: 500 });
  }

  const { clinicId, email, role, fullName } = (await req.json()) as {
    clinicId: string; email: string; role: MemberRole; fullName?: string;
  };
  if (!clinicId || !email || !role) {
    return NextResponse.json({ error: "חסרים פרטים בבקשה" }, { status: 400 });
  }

  const inviter = await requireAdmin(clinicId);
  if (!inviter) return NextResponse.json({ error: "אין לך הרשאה להזמין משתמשים בקליניקה זו" }, { status: 403 });

  const admin = createAdminClient();
  const supabase = createClient();

  // Check for duplicate pending invitation
  const { data: existingInvite } = await admin
    .from("invitations")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json({ error: "כבר קיימת הזמנה ממתינה לכתובת מייל זו" }, { status: 409 });
  }

  // Check if user already exists
  const { data: allUsers } = await admin.auth.admin.listUsers();
  const existingUser = allUsers?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    const { data: existingMember } = await admin
      .from("clinic_members")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMember?.status === "active") {
      return NextResponse.json({ error: "המשתמש כבר חבר פעיל בקליניקה זו" }, { status: 409 });
    }
    if (existingMember?.status === "disabled") {
      return NextResponse.json({ error: "המשתמש קיים אך מושבת — הפעל אותו מרשימת חברי הצוות" }, { status: 409 });
    }
  }

  const [{ data: clinic }, { data: inviterProfile }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("profiles").select("full_name").eq("id", inviter.id).single(),
  ]);

  // Existing user but not a member → add directly
  if (existingUser) {
    await admin.from("clinic_members").upsert(
      { clinic_id: clinicId, user_id: existingUser.id, role, invited_by: inviter.id, status: "active" },
      { onConflict: "clinic_id,user_id" }
    );
    await admin.from("invitations").insert({
      clinic_id: clinicId, email: email.toLowerCase(), role, invited_by: inviter.id,
      status: "accepted", accepted_at: new Date().toISOString(),
    });

    const notifyHtml = addedEmailHtml({
      clinicName: clinic?.name ?? "praxisAI",
      inviterName: inviterProfile?.full_name || "מנהל הקליניקה",
      roleHe: ROLE_HE[role],
      loginLink: `${APP_URL}/dashboard`,
    });
    const { sent } = await sendEmail(email, `נוספת לצוות ${clinic?.name ?? "praxisAI"} — praxisAI`, notifyHtml);
    return NextResponse.json({ ok: true, sent, existed: true });
  }

  // New user → create invite
  const { error: invErr } = await admin.from("invitations").insert({
    clinic_id: clinicId, email: email.toLowerCase(), role, invited_by: inviter.id,
  });
  if (invErr) return NextResponse.json({ error: "יצירת ההזמנה נכשלה" }, { status: 500 });

  const meta = { full_name: fullName ?? "", invited_clinic_id: clinicId, invited_role: role, invited_by: inviter.id };
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: meta, redirectTo: `${APP_URL}/welcome` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: "יצירת קישור ההזמנה נכשלה" }, { status: 500 });
  }

  const actionLink = linkData.properties.action_link;
  const emailHtml = inviteEmailHtml({
    clinicName: clinic?.name ?? "praxisAI",
    inviterName: inviterProfile?.full_name || "מנהל הקליניקה",
    roleHe: ROLE_HE[role],
    actionLink,
  });

  const { sent } = await sendEmail(email, `הוזמנת להצטרף ל${clinic?.name ?? "praxisAI"} — praxisAI`, emailHtml);
  if (!sent) return NextResponse.json({ ok: true, sent: false, link: actionLink });
  return NextResponse.json({ ok: true, sent: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const clinicId = searchParams.get("clinicId");
  if (!id || !clinicId) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const inviter = await requireAdmin(clinicId);
  if (!inviter) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminClient();
  await admin.from("invitations").update({ status: "revoked" }).eq("id", id).eq("clinic_id", clinicId);
  return NextResponse.json({ ok: true });
}

// "You've been added" notification email
interface AddedEmailParams { clinicName: string; inviterName: string; roleHe: string; loginLink: string; appUrl?: string; }

function addedEmailHtml({ clinicName, inviterName, roleHe, loginLink,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://praxisai-one.vercel.app",
}: AddedEmailParams) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>נוספת לקליניקה</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td style="background:linear-gradient(135deg,#0f1923 0%,#1a2e42 100%);border-radius:16px 16px 0 0;padding:32px 40px 28px;" align="right">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td><img src="${appUrl}/logo.svg" alt="praxisAI" width="36" height="36" style="display:block;border:0;" /></td>
          <td style="padding-right:10px;"><span style="color:#fff;font-size:20px;font-weight:700;">praxisAI</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background-color:#fff;border:1px solid #e2e8f0;border-top:none;padding:44px 40px 36px;" align="right" dir="rtl">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;">נוספת לצוות ${clinicName}</h1>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#475569;">
          <strong style="color:#0f172a;">${inviterName}</strong> הוסיף/ה אותך לקליניקה <strong>${clinicName}</strong> בתפקיד&nbsp;<strong style="color:#2563eb;">${roleHe}</strong>.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:12px;background-color:#2563eb;">
            <a href="${loginLink}" style="display:inline-block;padding:15px 48px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">כניסה למערכת</a>
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
