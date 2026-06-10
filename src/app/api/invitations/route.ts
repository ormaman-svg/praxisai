import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteEmailHtml } from "@/lib/email/invite-template";
import { ROLE_HE, type MemberRole } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function requireAdmin(clinicId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
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

  const [{ data: clinic }, { data: inviterProfile }] = await Promise.all([
    supabase.from("clinics").select("name").eq("id", clinicId).single(),
    supabase.from("profiles").select("full_name").eq("id", inviter.id).single(),
  ]);

  // 1) invitation record (audit + pending list)
  const { error: invErr } = await admin.from("invitations").insert({
    clinic_id: clinicId, email: email.toLowerCase(), role, invited_by: inviter.id,
  });
  if (invErr) return NextResponse.json({ error: "יצירת ההזמנה נכשלה" }, { status: 500 });

  // 2) generate Supabase action link (creates the user → DB trigger attaches membership)
  let actionLink: string | null = null;
  const meta = {
    full_name: fullName ?? "",
    invited_clinic_id: clinicId,
    invited_role: role,
    invited_by: inviter.id,
  };

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: meta, redirectTo: `${APP_URL}/welcome` },
  });

  if (!linkErr && linkData?.properties?.action_link) {
    actionLink = linkData.properties.action_link;
  } else {
    // user already exists (e.g. member of another clinic) → attach membership + magic link
    const { data: userByEmail } = await admin.auth.admin.listUsers();
    const found = userByEmail?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) return NextResponse.json({ error: "יצירת המשתמש נכשלה" }, { status: 500 });

    await admin.from("clinic_members").upsert(
      { clinic_id: clinicId, user_id: found.id, role, invited_by: inviter.id, status: "active" },
      { onConflict: "clinic_id,user_id" }
    );
    await admin.from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("clinic_id", clinicId).ilike("email", email).eq("status", "pending");

    const { data: magic } = await admin.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: `${APP_URL}/dashboard` },
    });
    actionLink = magic?.properties?.action_link ?? `${APP_URL}/login`;
  }

  // 3) branded email via Resend (graceful fallback: return the link to copy)
  const emailHtml = inviteEmailHtml({
    clinicName: clinic?.name ?? "praxisAI",
    inviterName: inviterProfile?.full_name || "מנהל הקליניקה",
    roleHe: ROLE_HE[role],
    actionLink: actionLink!,
  });

  // 1) Try Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM ?? "praxisAI <onboarding@resend.dev>";
      const { data, error: sendErr } = await resend.emails.send({
        from, to: email,
        subject: `הוזמנת להצטרף ל${clinic?.name ?? "praxisAI"} — praxisAI`,
        html: emailHtml,
      });
      if (!sendErr) {
        console.log("[Resend] sent ok, id:", data?.id);
        return NextResponse.json({ ok: true, sent: true });
      }
      console.error("[Resend] send error:", JSON.stringify(sendErr));
    } catch (e) {
      console.error("[Resend] exception:", e);
    }
  }

  // 2) Fallback: Gmail SMTP via nodemailer
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      await transporter.sendMail({
        from: `"praxisAI" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `הוזמנת להצטרף ל${clinic?.name ?? "praxisAI"} — praxisAI`,
        html: emailHtml,
      });
      console.log("[Gmail] sent ok to:", email);
      return NextResponse.json({ ok: true, sent: true });
    } catch (e) {
      console.error("[Gmail] exception:", e);
    }
  }

  return NextResponse.json({ ok: true, sent: false, link: actionLink });
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
