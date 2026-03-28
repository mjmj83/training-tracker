import fs from "fs";
import path from "path";
import crypto from "crypto";

// ExerciseDB v1 (free, self-hosted on Vercel) — search exercises by name and get gifUrl
const API_BASE = "https://exercisedb-api.vercel.app/api/v1/exercises";

// Local GIF cache directory — same volume as the database
const dbPath = process.env.DATABASE_PATH || "training.db";
const dataDir = path.dirname(dbPath) === "." ? "." : path.dirname(dbPath);
const GIF_DIR = path.join(dataDir, "exercise-gifs");

// Ensure gif directory exists
if (!fs.existsSync(GIF_DIR)) {
  fs.mkdirSync(GIF_DIR, { recursive: true });
}

const gifCount = fs.readdirSync(GIF_DIR).filter(f => f.endsWith(".gif")).length;
console.log(`[exercise-lookup] GIF cache: ${GIF_DIR} (${gifCount} cached)`);

// Generate a safe filename from a unique key
function toFilename(key: string): string {
  const hash = crypto.createHash("md5").update(key).digest("hex").slice(0, 12);
  const safe = key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
  return `${safe}_${hash}.gif`;
}

// Download a GIF from URL and save locally, return local path
export async function cacheGif(remoteUrl: string): Promise<string | null> {
  try {
    const filename = toFilename(remoteUrl);
    const filepath = path.join(GIF_DIR, filename);

    // Don't re-download if already cached
    if (fs.existsSync(filepath)) {
      return `/api/exercise-gifs/${filename}`;
    }

    const res = await fetch(remoteUrl);
    if (!res.ok) {
      console.error(`[exercise-lookup] Failed to download GIF: ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    console.log(`[exercise-lookup] Cached GIF: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return `/api/exercise-gifs/${filename}`;
  } catch (e: any) {
    console.error("[exercise-lookup] Cache error:", e.message);
    return null;
  }
}

// Search the API and return multiple options (name + gifUrl)
export interface ExerciseImageOption {
  name: string;
  gifUrl: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
}

export async function searchExerciseImages(query: string, limit: number = 5): Promise<ExerciseImageOption[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const encoded = encodeURIComponent(query.trim().toLowerCase());
    const url = `${API_BASE}?search=${encoded}&limit=${limit}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[exercise-lookup] API error ${res.status}`);
      return [];
    }

    const json = await res.json();
    const exercises = json?.data?.exercises ?? json?.data ?? [];

    if (!Array.isArray(exercises)) return [];

    return exercises
      .filter((ex: any) => ex.gifUrl)
      .map((ex: any) => ({
        name: ex.name,
        gifUrl: ex.gifUrl,
        bodyPart: ex.bodyParts?.[0] || ex.bodyPart,
        target: ex.targetMuscles?.[0] || ex.target,
        equipment: ex.equipments?.[0] || ex.equipment,
      }));
  } catch (e: any) {
    console.error("[exercise-lookup] Search error:", e.message);
    return [];
  }
}

// Auto-pick: search and cache the first result (used on exercise create/rename)
export async function findExerciseImage(name: string): Promise<string | null> {
  if (!name || name.trim().length < 2) return null;

  const results = await searchExerciseImages(name, 1);
  if (results.length > 0) {
    return await cacheGif(results[0].gifUrl);
  }
  return null;
}

// Export for serving cached GIFs
export function getGifDir(): string {
  return GIF_DIR;
}
