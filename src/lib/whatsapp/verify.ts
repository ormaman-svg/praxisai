import { createHmac } from "crypto";

/** Validate X-Hub-Signature-256 header from 360dialog/Meta webhook. */
export function verifySignature(body: string, signature: string, appSecret: string): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest("hex");
  const received = signature.slice(7);
  // Constant-time comparison
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}
