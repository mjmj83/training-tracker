// ExerciseDB v1 (free, self-hosted on Vercel) — search exercises by name and get gifUrl
const BASE_URL = "https://exercisedb-api.vercel.app/api/v1/exercises";

console.log("[exercise-lookup] Using free ExerciseDB API — GIF image lookup enabled");

export async function findExerciseImage(name: string): Promise<string | null> {
  if (!name || name.trim().length < 2) return null;

  try {
    const encoded = encodeURIComponent(name.trim().toLowerCase());
    const url = `${BASE_URL}?search=${encoded}&limit=1`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[exercise-lookup] API error ${res.status}: ${await res.text()}`);
      return null;
    }

    const json = await res.json();
    const exercises = json?.data?.exercises ?? json?.data ?? [];

    if (Array.isArray(exercises) && exercises.length > 0 && exercises[0].gifUrl) {
      return exercises[0].gifUrl;
    }
    return null;
  } catch (e: any) {
    console.error("[exercise-lookup] Fetch error:", e.message);
    return null;
  }
}
