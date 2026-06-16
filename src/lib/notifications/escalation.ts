import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

const REASON_TEXT: Record<string, string> = {
  media: "המטופל שלח וידאו / תמונה לבדיקה",
  bot: "הבוט העביר את השיחה לנציג",
};

function html(patientName: string, reason: string, inboxUrl: string) {
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;direction:rtl">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px">
    <span style="font-size:22px;font-weight:700;color:#fff">praxisAI</span>
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#1e293b">הודעה ממתינה לתשובתך</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      <strong>${patientName}</strong> — ${reason}
    </p>
    <a href="${inboxUrl}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
      פתח תיבת הודעות &larr;
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
      מייל זה נשלח אוטומטית על ידי praxisAI. ניתן לנהל העדפות התראות בהגדרות.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function notifyEscalation({
  clinicId,
  patientName,
  reason,
}: {
  clinicId: string;
  patientName: string;
  reason: "media" | "bot";
}) {
  try {
    const admin = createAdminClient();

    const { data: members } = await admin
      .from("clinic_members")
      .select("user_id")
      .eq("clinic_id", clinicId);
    if (!members?.length) return;

    const userIds = members.map((m) => m.user_id as string);

    // Fetch auth emails via admin API (service role bypasses auth schema restrictions)
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emails = users
      .filter((u) => userIds.includes(u.id) && u.email)
      .map((u) => u.email!);
    if (!emails.length) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const inboxUrl = `${appUrl}/inbox`;
    const subject = `הודעה מ-${patientName} מחכה לתשובתך — praxisAI`;
    const body = html(patientName, REASON_TEXT[reason] ?? reason, inboxUrl);

    await Promise.allSettled(emails.map((email) => sendEmail(email, subject, body)));
  } catch (e) {
    // Notifications are best-effort — never block the main flow
    console.error("[notify] escalation email failed:", e);
  }
}
