const YT_API = "https://www.googleapis.com/youtube/v3/search";

const PHYSIO_TERMS = "physiotherapy exercise tutorial";

/**
 * Returns the first YouTube video URL for a given exercise name.
 * Falls back to a YouTube search URL if the API key is missing or quota is exceeded.
 */
export async function findExerciseVideo(exerciseName: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = `${exerciseName} ${PHYSIO_TERMS}`;

  if (apiKey) {
    try {
      const url = new URL(YT_API);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoDuration", "short");  // under 4 min — demo clips
      url.searchParams.set("relevanceLanguage", "iw"); // Hebrew preference
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("maxResults", "1");
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json() as { items?: { id: { videoId: string } }[] };
        const videoId = data.items?.[0]?.id?.videoId;
        if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch {
      // fall through to search URL
    }
  }

  // Graceful fallback: open YouTube search in a new tab
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Enrich an array of exercise items with video URLs in parallel.
 *  Uses english_name (clinical term) when available for accurate YouTube results. */
export async function enrichWithVideos<T extends { name: string; english_name?: string; video_url?: string }>(
  items: T[]
): Promise<(T & { video_url: string })[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      video_url: item.video_url || (await findExerciseVideo(item.english_name || item.name)),
    }))
  );
}
