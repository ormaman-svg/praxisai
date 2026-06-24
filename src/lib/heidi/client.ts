const BASE = "https://registrar.api.heidihealth.com/api/v2/ml-scribe/open-api";

export async function getHeiToken(userEmail: string, thirdPartyId: string): Promise<string> {
  const url = `${BASE}/jwt?email=${encodeURIComponent(userEmail)}&third_party_internal_id=${encodeURIComponent(thirdPartyId)}`;
  const res = await fetch(url, {
    headers: { "Heidi-Api-Key": process.env.HEIDI_API_KEY! },
  });
  if (!res.ok) {
    throw new Error(`Heidi JWT failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  // Response shape: { jwt: "..." } or { token: "..." } or the string itself
  return data.jwt ?? data.token ?? data;
}

export async function createSession(jwt: string): Promise<string> {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ language: "he" }),
  });
  if (!res.ok) {
    throw new Error(`Heidi createSession failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const sessionId = data.session_id ?? data.id ?? data.sessionId;
  if (!sessionId) throw new Error("Heidi createSession: no session_id in response");
  return String(sessionId);
}

// Heidi accepts MP3/WAV/M4A. Webm (Chrome) and MP4 (Safari) must be sent as-is;
// Heidi may accept them — we forward with original content-type and let their API decide.
export async function uploadAudio(
  jwt: string,
  sessionId: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  // Derive a filename extension from content-type for servers that inspect it
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "webm";
  form.append("audio", blob, `recording.${ext}`);

  const res = await fetch(`${BASE}/sessions/${sessionId}/audio`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Heidi uploadAudio failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
}

export async function getTranscript(jwt: string, sessionId: string): Promise<string> {
  // Poll until transcript is ready (Heidi processes async)
  const MAX_POLLS = 20;
  const INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`${BASE}/sessions/${sessionId}/transcript`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      throw new Error(`Heidi getTranscript failed (${res.status}): ${await res.text().catch(() => "")}`);
    }
    const data = await res.json();

    // Status may be "pending" / "processing" / "completed" / "done"
    const status = data.status ?? data.state ?? "completed";
    if (status === "pending" || status === "processing") {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      continue;
    }

    const transcript =
      data.transcript ??
      data.text ??
      data.result?.transcript ??
      data.result?.text ??
      "";
    return transcript;
  }

  throw new Error("Heidi transcript timed out after polling");
}

export async function transcribeAudio(
  userId: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const email = process.env.HEIDI_USER_EMAIL ?? "scribe@praxisai.app";
  const jwt = await getHeiToken(email, userId);
  const sessionId = await createSession(jwt);
  await uploadAudio(jwt, sessionId, buffer, contentType);
  return getTranscript(jwt, sessionId);
}
