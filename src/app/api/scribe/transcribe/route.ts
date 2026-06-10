import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const audio = form.get("audio") as Blob | null;
  if (!audio) return Response.json({ error: "No audio" }, { status: 400 });

  const buffer = await audio.arrayBuffer();

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&language=he&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DG_KEY}`,
        "Content-Type": "audio/webm",
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Deepgram error:", err);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }

  const data = await res.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return Response.json({ transcript });
}
