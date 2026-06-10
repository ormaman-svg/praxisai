interface InviteEmailParams {
  clinicName: string;
  inviterName: string;
  roleHe: string;
  actionLink: string;
  appUrl?: string;
}

export function inviteEmailHtml({
  clinicName,
  inviterName,
  roleHe,
  actionLink,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://praxisai-one.vercel.app",
}: InviteEmailParams) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>הוזמנת ל‑praxisAI</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
           style="max-width:560px;width:100%;">

      <!-- ── HEADER ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#0f1923 0%,#1a2e42 100%);
                   border-radius:16px 16px 0 0;
                   padding:32px 40px 28px;"
            align="right">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;">
                <img src="${appUrl}/logo.svg"
                     alt="praxisAI"
                     width="36" height="36"
                     style="display:block;border:0;width:36px;height:36px;" />
              </td>
              <td style="padding-right:10px;vertical-align:middle;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.2px;
                             font-family:'Segoe UI',Arial,sans-serif;">praxisAI</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ── HERO BAND ── -->
      <tr>
        <td style="background-color:#2563eb;padding:20px 40px;" align="right">
          <p style="margin:0;font-size:13px;font-weight:600;color:#bfdbfe;
                    letter-spacing:0.8px;text-transform:uppercase;">
            הזמנה לקליניקה
          </p>
        </td>
      </tr>

      <!-- ── BODY ── -->
      <tr>
        <td style="background-color:#ffffff;
                   border:1px solid #e2e8f0;border-top:none;
                   padding:44px 40px 36px;"
            align="right" dir="rtl">

          <!-- Greeting -->
          <h1 style="margin:0 0 10px;font-size:24px;font-weight:700;
                     color:#0f172a;line-height:1.3;
                     font-family:'Segoe UI',Arial,sans-serif;">
            הוזמנת להצטרף ל‑${clinicName} 🎉
          </h1>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#475569;">
            <strong style="color:#0f172a;">${inviterName}</strong>
            הזמין/ה אותך להצטרף לצוות הקליניקה ב‑praxisAI
            בתפקיד&nbsp;<strong style="color:#2563eb;">${roleHe}</strong>.
          </p>

          <!-- CTA Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                 style="margin-bottom:32px;">
            <tr>
              <td style="border-radius:12px;background-color:#2563eb;
                         box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                <a href="${actionLink}"
                   style="display:inline-block;padding:15px 48px;
                          color:#ffffff;font-size:15px;font-weight:700;
                          text-decoration:none;border-radius:12px;
                          font-family:'Segoe UI',Arial,sans-serif;
                          letter-spacing:0.1px;">
                  הצטרפות לקליניקה ←
                </a>
              </td>
            </tr>
          </table>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="margin-bottom:24px;">
            <tr>
              <td style="border-top:1px solid #f1f5f9;font-size:0;">&nbsp;</td>
            </tr>
          </table>

          <!-- What is praxisAI -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background-color:#f8fafc;border-radius:12px;padding:0;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px;" dir="rtl">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;
                           color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">
                  מה זה praxisAI?
                </p>
                ${[
                  ["🎙️", "תיעוד קולי אוטומטי", "הקלטת הטיפול מתומללת ומומרת לרשומת SOAP בעברית."],
                  ["📄", "מסמכים בלחיצה", "הפניות, דוחות והתכתבויות — נוצרים אוטומטית מהתיק הקליני."],
                  ["📊", "מעקב תוצאים", "גרפי התקדמות ומדדי כאב לאורך כל הטיפול."],
                ]
                  .map(([icon, title, desc]) => `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                       style="margin-bottom:10px;width:100%;">
                  <tr>
                    <td style="font-size:18px;vertical-align:top;padding-left:10px;
                               width:28px;">${icon}</td>
                    <td style="vertical-align:top;">
                      <span style="font-size:13px;font-weight:700;color:#0f172a;">${title}</span>
                      <span style="font-size:13px;color:#64748b;"> — ${desc}</span>
                    </td>
                  </tr>
                </table>`)
                  .join("")}
              </td>
            </tr>
          </table>

          <!-- Expiry note -->
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
            ⏱ הקישור בתוקף ל‑7 ימים. אם הכפתור לא עובד, העתיקו את הכתובת:
          </p>
          <p style="margin:0;font-size:11px;color:#2563eb;
                    word-break:break-all;direction:ltr;text-align:left;
                    background-color:#eff6ff;border-radius:6px;padding:8px 10px;">
            ${actionLink}
          </p>

        </td>
      </tr>

      <!-- ── FOOTER ── -->
      <tr>
        <td style="background-color:#f8fafc;
                   border:1px solid #e2e8f0;border-top:none;
                   border-radius:0 0 16px 16px;
                   padding:24px 40px;"
            align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                 style="margin-bottom:12px;">
            <tr>
              <td style="vertical-align:middle;">
                <img src="${appUrl}/logo.svg" alt="" width="20" height="20"
                     style="display:block;width:20px;height:20px;opacity:0.5;" />
              </td>
              <td style="padding-right:6px;vertical-align:middle;">
                <span style="font-size:13px;font-weight:700;color:#94a3b8;">praxisAI</span>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">
            פלטפורמת AI קלינית לקליניקות פיזיותרפיה בישראל<br>
            אם לא ציפית להזמנה זו, פשוט התעלמו מהמייל הזה.
          </p>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>

</body>
</html>`;
}
