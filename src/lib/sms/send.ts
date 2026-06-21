// SERVER ONLY — sends an SMS via Twilio when configured.
// SMS is optional: identity verification also works via national ID, which needs
// no external provider. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_FROM (an SMS-capable sender) to enable the SMS one-time-code method.
export async function sendSms(to: string, text: string): Promise<{ sent: boolean }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { sent: false };

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
      }
    );
    if (!res.ok) {
      console.error("[twilio] send failed:", res.status, await res.text().catch(() => ""));
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[twilio] exception:", e);
    return { sent: false };
  }
}

/** True when an SMS provider is configured (so the bot can offer the SMS method). */
export function smsEnabled(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}
