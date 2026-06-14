// 360dialog WhatsApp Business API client.
// Docs: https://docs.360dialog.com/whatsapp-api/whatsapp-api/media
//
// Per-clinic credentials are stored in clinics.settings:
//   settings.wa_phone_id  — 360dialog phone_id
//   settings.wa_api_key   — 360dialog API key
//   settings.wa_waba_id   — WABA ID (for template management)

import { TEMPLATES, type TemplateKey } from "./templates";

const BASE = "https://waba.360dialog.io/v1";

type Credentials = { phoneId: string; apiKey: string };

function apiHeaders(apiKey: string) {
  return { "D360-API-KEY": apiKey, "Content-Type": "application/json" };
}

/** Send an approved Meta template to a phone number (E.164 format). */
export async function sendTemplate(
  creds: Credentials,
  to: string,
  templateKey: TemplateKey,
  vars: string[]
): Promise<string> {
  const tpl = TEMPLATES[templateKey];
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: tpl.name,
      language: { code: tpl.language },
      components: vars.length
        ? [
            {
              type: "body",
              parameters: vars.map((v) => ({ type: "text", text: v })),
            },
          ]
        : [],
    },
  };

  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: apiHeaders(creds.apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`360dialog sendTemplate failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.messages?.[0]?.id ?? "";
}

/** Send a free-form text reply (only valid within 24h customer-service window). */
export async function sendText(
  creds: Credentials,
  to: string,
  text: string
): Promise<string> {
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: apiHeaders(creds.apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`360dialog sendText failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.messages?.[0]?.id ?? "";
}

/** Mark a received message as read. */
export async function markRead(creds: Credentials, waMessageId: string) {
  await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: apiHeaders(creds.apiKey),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: waMessageId,
    }),
  });
}
