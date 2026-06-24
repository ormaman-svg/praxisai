import { createClient } from "@/lib/supabase/server";
import { transcribeAudio as heidiTranscribe } from "@/lib/heidi/client";

export const maxDuration = 60; // transcription can take a while on long recordings

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

  const form = await request.formData();
  const audio = form.get("audio") as Blob | null;
  if (!audio) return Response.json({ error: "No audio" }, { status: 400 });

  const buffer = await audio.arrayBuffer();
  const contentType = (audio.type || "audio/webm").split(";")[0];

  if (buffer.byteLength < 2000) {
    return Response.json(
      { error: "לא נקלט אודיו (ההקלטה ריקה או קצרה מדי). בדקו שהמיקרופון פעיל ונסו שוב." },
      { status: 422 }
    );
  }

  // Heidi path — enabled when HEIDI_API_KEY is configured
  if (process.env.HEIDI_API_KEY) {
    try {
      const transcript = await heidiTranscribe(user.id, buffer, contentType);
      return Response.json({ transcript });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[heidi] transcription failed, falling back to Deepgram:", msg);
      // Fall through to Deepgram
    }
  }

  // Deepgram path (default / fallback)
  if (!process.env.DG_KEY) {
    return Response.json({ error: "DG_KEY חסר בהגדרות הסביבה של Vercel." }, { status: 500 });
  }

  // nova-2 first (fast, supports Hebrew); fall back to whisper-large on failure.
  let res = await deepgram("nova-2", buffer, contentType);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`Deepgram nova-2 failed (${res.status}), falling back to whisper-large:`, err);
    res = await deepgram("whisper-large", buffer, contentType);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`Deepgram whisper-large failed (${res.status}):`, err);
    const hint = res.status === 400
      ? "פורמט ההקלטה לא נתמך — נסו דפדפן אחר (מומלץ Chrome)."
      : "שירות התמלול אינו זמין כרגע — נסו שוב בעוד רגע.";
    return Response.json({ error: `התמלול נכשל. ${hint}` }, { status: 502 });
  }

  const data = await res.json();
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return Response.json({ transcript });
}
