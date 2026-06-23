// Evolution API (open-source, Baileys-based) client.
// Self-hosted: https://github.com/EvolutionAPI/evolution-api
// Supports QR-based connection, multi-tenant instances, and full media (video/image/audio/document).

export type EvolutionCreds = {
  host: string;     // e.g. "https://evo.my-server.com"
  apiKey: string;   // instance-level API key (returned from /instance/create)
  instance: string; // instance name
};

export function toChatId(phone: string): string {
  // Evolution accepts E.164 digits without the leading +
  return phone.replace(/^\+/, "");
}

export function chatIdToPhone(jid: string): string {
  // "972501234567@s.whatsapp.net" → "+972501234567"
  const digits = jid.split("@")[0];
  return `+${digits}`;
}

function headers(apiKey: string): Record<string, string> {
  return { "Content-Type": "application/json", apikey: apiKey };
}

// A WhatsApp message key — enough to quote, delete, or reference a message.
export type WaMsgKey = { id: string; remoteJid: string; fromMe: boolean };

export async function sendText(
  creds: EvolutionCreds,
  to: string,
  text: string,
  quoted?: { key: WaMsgKey; text: string }
): Promise<string> {
  const body: Record<string, unknown> = { number: toChatId(to), text };
  if (quoted) {
    body.quoted = {
      key: quoted.key,
      message: { conversation: quoted.text },
    };
  }
  const r = await fetch(`${creds.host}/message/sendText/${creds.instance}`, {
    method: "POST",
    headers: headers(creds.apiKey),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Evolution sendText ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.key?.id ?? d.messageId ?? "";
}

// Deletes a message for everyone (revoke). Only works on messages we sent
// (fromMe=true) and within WhatsApp's revoke window. key comes from the
// stored wa_message_id + the conversation's remoteJid.
export async function deleteMessageForEveryone(
  creds: EvolutionCreds,
  key: WaMsgKey
): Promise<boolean> {
  const r = await fetch(`${creds.host}/chat/deleteMessageForEveryone/${creds.instance}`, {
    method: "DELETE",
    headers: headers(creds.apiKey),
    body: JSON.stringify(key),
  });
  return r.ok;
}

export async function sendMedia(
  creds: EvolutionCreds,
  to: string,
  mediaUrl: string,
  caption: string,
  mediaType: "image" | "video" | "audio" | "document"
): Promise<string> {
  const r = await fetch(`${creds.host}/message/sendMedia/${creds.instance}`, {
    method: "POST",
    headers: headers(creds.apiKey),
    body: JSON.stringify({ number: toChatId(to), mediatype: mediaType, media: mediaUrl, caption }),
  });
  if (!r.ok) throw new Error(`Evolution sendMedia ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.key?.id ?? d.messageId ?? "";
}

export async function getConnectionState(
  creds: EvolutionCreds
): Promise<"open" | "close" | "connecting"> {
  try {
    const r = await fetch(`${creds.host}/instance/connectionState/${creds.instance}`, {
      headers: { apikey: creds.apiKey },
    });
    if (!r.ok) return "close";
    const d = await r.json();
    // v1: d.state  v2: d.instance.state
    return (d.instance?.state ?? d.state ?? "close") as "open" | "close" | "connecting";
  } catch {
    return "close";
  }
}

export type QrResult = {
  base64: string | null;
  status: number;
  raw: unknown;
};

export async function getQrCode(creds: EvolutionCreds): Promise<QrResult> {
  const r = await fetch(`${creds.host}/instance/connect/${creds.instance}`, {
    headers: { apikey: creds.apiKey },
  });
  let raw: unknown = null;
  try {
    raw = await r.json();
  } catch {
    raw = await r.text().catch(() => null);
  }
  if (!r.ok) {
    console.error("[evolution] getQrCode failed:", r.status, raw);
    return { base64: null, status: r.status, raw };
  }
  const d = (raw ?? {}) as Record<string, any>;
  console.log("[evolution] getQrCode response keys:", Object.keys(d));
  // v2 formats: { base64 } | { qrcode: { base64 } } | { qr: { base64 } }
  // Only accept a real data-URI image; the bare `code` field is the raw QR
  // payload string, not an image, so it can't be shown in an <img>.
  let b64: string | undefined =
    d.base64 ?? d.qrcode?.base64 ?? d.qr?.base64 ?? undefined;
  if (b64 && !b64.startsWith("data:")) b64 = `data:image/png;base64,${b64}`;
  return { base64: b64 ?? null, status: r.status, raw };
}

// Registers (idempotently) the inbound-message webhook on the instance so
// Evolution delivers MESSAGES_UPSERT events to our app. Safe to call repeatedly.
export async function setWebhook(
  creds: EvolutionCreds,
  webhookUrl: string
): Promise<boolean> {
  try {
    const r = await fetch(`${creds.host}/webhook/set/${creds.instance}`, {
      method: "POST",
      headers: headers(creds.apiKey),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    });
    if (!r.ok) {
      console.error("[evolution] setWebhook failed:", r.status, await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[evolution] setWebhook exception:", e);
    return false;
  }
}

// Forces Evolution to drop any half-open session and start a fresh QR cycle.
// Useful when /instance/connect returns no QR because the instance is stuck.
export async function restartInstance(creds: EvolutionCreds): Promise<void> {
  await fetch(`${creds.host}/instance/restart/${creds.instance}`, {
    method: "POST",
    headers: { apikey: creds.apiKey },
  }).catch(() => {});
}

// Clears the instance's stored WhatsApp session. This is the fix for
// /instance/connect returning { count: 0 }: the instance is stuck trying to
// resume a stale session instead of emitting a fresh QR. After logout, the
// next connect() forces Baileys to generate a new QR code.
export async function logoutInstance(creds: EvolutionCreds): Promise<void> {
  await fetch(`${creds.host}/instance/logout/${creds.instance}`, {
    method: "DELETE",
    headers: { apikey: creds.apiKey },
  }).catch(() => {});
}

// Downloads media from an Evolution message via the API (used when webhookBase64=false).
// key + message come directly from the webhook payload's data.key / data.message fields.
export async function getMediaBase64(
  creds: EvolutionCreds,
  key: Record<string, unknown>,
  message: Record<string, unknown>
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const r = await fetch(`${creds.host}/chat/getBase64FromMediaMessage/${creds.instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: creds.apiKey },
      body: JSON.stringify({ message: { key, message }, convertToMp4: false }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.base64) return null;
    return { base64: d.base64, mimeType: d.mimetype ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteInstance(
  host: string,
  globalApiKey: string,
  instanceName: string
): Promise<void> {
  await fetch(`${host}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: { apikey: globalApiKey },
  });
}

export async function createInstance(
  host: string,
  globalApiKey: string,
  instanceName: string
): Promise<{ apikey: string; qrBase64: string | null }> {
  const r = await fetch(`${host}/instance/create`, {
    method: "POST",
    headers: headers(globalApiKey),
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
  if (!r.ok) throw new Error(`Evolution createInstance ${r.status}: ${await r.text()}`);
  const d = await r.json();
  console.log("[evolution] createInstance response keys:", Object.keys(d));
  // v2.2.3 returns { hash: "UUID-string" } where the UUID is the instance API key.
  // Earlier versions return { hash: { apikey: "..." } }.
  const key = d.hash?.apikey ?? (typeof d.hash === "string" ? d.hash : "") ?? d.apikey ?? "";
  // In v2 the QR is delivered in the create response itself (qrcode: true),
  // NOT from a later /instance/connect call (which returns { count: N }).
  let qrBase64: string | null = d.qrcode?.base64 ?? null;
  if (qrBase64 && !qrBase64.startsWith("data:")) qrBase64 = `data:image/png;base64,${qrBase64}`;
  return { apikey: key, qrBase64 };
}
