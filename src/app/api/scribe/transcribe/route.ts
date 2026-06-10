import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60; // whisper transcription can take a while on long recordings

async function deepgram(model: string, buffer: ArrayBuffer, contentType: string) {
  return fetch(
    `https://api.deepgram.com/v1/listen?model=${model}&language=he&smart_format=true&punctuate=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DG_KEY}`,
        "Content-Type": contentType,
      },
      body: buffer,
    }
  );
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.DG_KEY) {
    return Response.json({ error: "DG_KEY חסר בהגדרות הסביבה של Vercel." }, { status: 500 });
  }

  const form = await request.formData();
  const audio = form.get("audio") as Blob | null;
  if (!audio) return Response.json({ error: "No audio" }, { status: 400 });

  const buffer = await audio.arrayBuffer();
  // Browsers differ: Chrome records audio/webm, Safari audio/mp4 — forward the real type.
  const contentType = audio.type || "audio/webm";

  // nova-2 first (fast); Hebrew may require Deepgram's whisper models — fall back.
  let res = await deepgram("nova-2", buffer, contentType);
  if (!res.ok) {
    const err = await res.text();
    console.error("Deepgram nova-2 error, falling back to whisper-large:", err);
    res = await deepgram("whisper-large", buffer, contentType);
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("Deepgram whisper-large error:", err);
    return Response.json({ error: "התמלול נכשל בשירות הקול — נסו שוב." }, { status: 500 });
  }

  const data = await res.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return Response.json({ transcript });
}
