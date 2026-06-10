// SERVER ONLY — sends transactional email via Resend, falling back to Gmail SMTP.
// Returns whether the message was actually handed off to a provider.
export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM ?? "praxisAI <onboarding@resend.dev>";
      const { error } = await resend.emails.send({ from, to, subject, html });
      if (!error) return { sent: true };
      console.error("[Resend] send error:", JSON.stringify(error));
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
