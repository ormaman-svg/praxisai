// Meta WhatsApp Cloud API client (direct — no BSP/360dialog).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// Per-clinic credentials are stored in clinics.settings:
//   settings.wa_phone_number_id  — Meta "Phone number ID"
//   settings.wa_access_token     — Meta permanent access token (System User)
//   settings.wa_waba_id          — WhatsApp Business Account ID (optional)

import { TEMPLATES, type TemplateKey } from "./templates";

const GRAPH = "https://graph.facebook.com/v20.0";

export type Credentials = { phoneNumberId: string; accessToken: string };

function headers(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

// Meta expects the recipient as digits in E.164 form, without a leading "+".
function toRecipient(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function postMessage(creds: Credentials, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${GRAPH}/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  if (!res.ok) {
    throw new Error(`Meta Cloud API error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.messages?.[0]?.id ?? "";
}

/** Send an approved Meta template (required outside the 24h customer-service window). */
export async function sendTemplate(
  creds: Credentials,
  to: string,
  templateKey: TemplateKey,
  vars: string[]
): Promise<string> {
  const tpl = TEMPLATES[templateKey];
  return postMessage(creds, {
    to: toRecipient(to),
    type: "template",
    template: {
      name: tpl.name,
      language: { code: tpl.language },
      components: vars.length
        ? [{ type: "body", parameters: vars.map((v) => ({ type: "text", text: v })) }]
        : [],
    },
  });
}

/** Send a free-form text reply (valid only inside the 24h service window). */
export async function sendText(creds: Credentials, to: string, text: string): Promise<string> {
  return postMessage(creds, {
    to: toRecipient(to),
    type: "text",
    text: { body: text },
  });
}

/**
 * Download a media file from Meta's Graph API.
 * Returns the raw bytes and MIME type.
 * Step 1: fetch the download URL via media_id.
 * Step 2: download the actual file using the same access token.
 */
export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: ArrayBuffer; mimeType: string }> {
  const infoRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: headers(accessToken),
  });
  if (!infoRes.ok) throw new Error(`Meta media info (${infoRes.status}): ${await infoRes.text()}`);
  const { url } = await infoRes.json() as { url: string };

  const fileRes = await fetch(url, { headers: headers(accessToken) });
  if (!fileRes.ok) throw new Error(`Meta media download (${fileRes.status}): ${await fileRes.text()}`);

  const mimeType = fileRes.headers.get("content-type") ?? "application/octet-stream";
  const data = await fileRes.arrayBuffer();
  return { data, mimeType };
}

/** Mark a received message as read. */
export async function markRead(creds: Credentials, waMessageId: string): Promise<void> {
  await fetch(`${GRAPH}/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: waMessageId }),
  });
}
