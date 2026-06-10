interface InviteEmailParams {
  clinicName: string;
  inviterName: string;
  roleHe: string;
  actionLink: string;
}

// Branded, RTL, table-based (email-client-safe) invitation email
export function inviteEmailHtml({ clinicName, inviterName, roleHe, actionLink }: InviteEmailParams) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="background-color:#0f1923;border-radius:14px 14px 0 0;padding:28px 36px;" align="right">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#2563eb;border-radius:9px;width:36px;height:36px;text-align:center;vertical-align:middle;color:#ffffff;font-size:18px;font-weight:bold;">P</td>
            <td style="padding-right:12px;color:#ffffff;font-size:19px;font-weight:bold;letter-spacing:.2px;">praxisAI</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:40px 36px;" align="right" dir="rtl">
          <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">הוזמנת להצטרף ל${clinicName}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">
            ${inviterName} הזמין/ה אותך להצטרף לצוות הקליניקה ב‑praxisAI
            בתפקיד <strong style="color:#0f172a;">${roleHe}</strong>.
            לחיצה על הכפתור תיקח אותך להגדרת סיסמה וכניסה ראשונה.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px;">
            <tr><td style="background-color:#2563eb;border-radius:10px;">
              <a href="${actionLink}" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">הצטרפות לקליניקה</a>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.6;">
            הקישור בתוקף ל‑7 ימים. אם הכפתור לא עובד, העתיקו את הכתובת לדפדפן:
          </p>
          <p style="margin:0;font-size:12px;color:#2563eb;word-break:break-all;direction:ltr;text-align:left;">${actionLink}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            praxisAI · פלטפורמת AI קלינית לקליניקות פיזיותרפיה ·
            אם לא ציפית להזמנה זו, אפשר להתעלם מהמייל.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
