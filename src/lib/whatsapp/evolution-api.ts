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

export async function sendText(creds: EvolutionCreds, to: string, text: string): Promise<string> {
  const r = await fetch(`${creds.host}/message/sendText/${creds.instance}`, {
    method: "POST",
    headers: headers(creds.apiKey),
    body: JSON.stringify({ number: toChatId(to), text }),
  });
  if (!r.ok) throw new Error(`Evolution sendText ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.key?.id ?? d.messageId ?? "";
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

// Forces Evolution to drop any half-open session and start a fresh QR cycle.
// Useful when /instance/connect returns no QR because the instance is stuck.
export async function restartInstance(creds: EvolutionCreds): Promise<void> {
  await fetch(`${creds.host}/instance/restart/${creds.instance}`, {
    method: "POST",
    headers: { apikey: creds.apiKey },
  }).catch(() => {});
}

export async function createInstance(
  host: string,
  globalApiKey: string,
  instanceName: string
): Promise<{ apikey: string }> {
  const r = await fetch(`${host}/instance/create`, {
    method: "POST",
    headers: headers(globalApiKey),
    body: JSON.stringify({ instanceName }),
  });
  if (!r.ok) throw new Error(`Evolution createInstance ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return { apikey: d.hash?.apikey ?? d.apikey ?? "" };
}
