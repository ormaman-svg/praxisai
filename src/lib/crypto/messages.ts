// Application-layer encryption for message content at rest (AES-256-GCM).
//
// Goal: message bodies are stored as ciphertext in the DB, so a DB dump,
// backup leak, or casual DB browsing never exposes patient↔clinic content.
// Authorized clinic staff still read plaintext because the server decrypts
// for them over an authenticated request (the AI bot also needs plaintext,
// so this is defense-at-rest, not zero-knowledge E2EE).
//
// Key: MESSAGE_ENCRYPTION_KEY — 32 bytes, base64-encoded. Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Safe rollout: if no key is configured the helpers pass text through
// unchanged, so deploying the code never breaks production before the secret
// is set. Legacy plaintext rows (written before the key existed) are detected
// by the missing prefix and returned as-is.

import crypto from "crypto";

const PREFIX = "enc1:";

function getKey(): Buffer | null {
  const b64 = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!b64) return null;
  try {
    const key = Buffer.from(b64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function encryptMessage(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const key = getKey();
  if (!key) return plain; // no key yet → store as-is (safe fallback)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptMessage(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getKey();
  if (!key) return ""; // ciphertext but no key — cannot reveal
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const ct = raw.subarray(12, raw.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
