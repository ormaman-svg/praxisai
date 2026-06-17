// Green API client — free, unofficial WhatsApp gateway (green-api.com).
// Connect by scanning a QR code from a phone; no Meta Business verification
// and no template approval required. Ideal for a quick / demo connection.
//
// Per-clinic credentials live in clinics.settings:
//   settings.green_id_instance   — Green API instance id (e.g. "1101000001")
//   settings.green_api_token     — Green API instance token
//
// Docs: https://green-api.com/en/docs/api/sending/SendMessage/

const BASE = "https://api.green-api.com";

export type GreenCreds = { idInstance: string; apiToken: string };

// Green API addresses chats as "<digits>@c.us" for individuals.
export function toChatId(phone: string): string {
  return `${phone.replace(/\D/g, "")}@c.us`;
}

// "972501234567@c.us" → "+972501234567"
export function chatIdToPhone(chatId: string): string {
  const digits = chatId.replace(/@c\.us$/i, "").replace(/\D/g, "");
  return `+${digits}`;
}

/** Send a free-form text message. Returns the Green API message id. */
export async function sendText(creds: GreenCreds, to: string, text: string): Promise<string> {
  const url = `${BASE}/waInstance${creds.idInstance}/sendMessage/${creds.apiToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: toChatId(to), message: text }),
  });
  if (!res.ok) {
    throw new Error(`Green API error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json().catch(() => ({}));
  return data.idMessage ?? "";
}

/** Check the instance authorization/connection state. */
export async function getStateInstance(creds: GreenCreds): Promise<string> {
  const url = `${BASE}/waInstance${creds.idInstance}/getStateInstance/${creds.apiToken}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Green API state (${res.status}): ${await res.text()}`);
  const data = await res.json().catch(() => ({}));
  return data.stateInstance ?? "unknown"; // "authorized" when connected
}
