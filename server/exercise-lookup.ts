// ExerciseDB v2 via RapidAPI — search exercises by name and get gifUrl
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const BASE_URL = "https://exercisedb.p.rapidapi.com/exercises/name";

if (RAPIDAPI_KEY) {
  console.log("[exercise-lookup] RapidAPI key configured — ExerciseDB image lookup enabled");
} else {
  console.warn("[exercise-lookup] No RAPIDAPI_KEY set — exercise image lookup disabled");
}

export async function findExerciseImage(name: string): Promise<string | null> {
  if (!RAPIDAPI_KEY || !name || name.trim().length < 2) return null;

  try {
    const encoded = encodeURIComponent(name.trim().toLowerCase());
    const url = `${BASE_URL}/${encoded}?limit=1`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
      },
    });

    if (!res.ok) {
      console.error(`[exercise-lookup] API error ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].gifUrl) {
      return data[0].gifUrl;
    }
    return null;
  } catch (e: any) {
    console.error("[exercise-lookup] Fetch error:", e.message);
    return null;
  }
}
