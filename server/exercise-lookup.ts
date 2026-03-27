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

// Generate a safe filename from exercise name
function nameToFilename(name: string): string {
  const hash = crypto.createHash("md5").update(name.toLowerCase().trim()).digest("hex").slice(0, 8);
  const safe = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  return `${safe}_${hash}.gif`;
}

// Check if we already have this GIF cached locally
function getCachedGif(name: string): string | null {
  const filename = nameToFilename(name);
  const filepath = path.join(GIF_DIR, filename);
  if (fs.existsSync(filepath)) {
    return `/api/exercise-gifs/${filename}`;
  }
  return null;
}

// Download a GIF from URL and save locally
async function cacheGif(name: string, remoteUrl: string): Promise<string | null> {
  try {
    const filename = nameToFilename(name);
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

// Main lookup: check local cache first, then API, then cache the result
export async function findExerciseImage(name: string): Promise<string | null> {
  if (!name || name.trim().length < 2) return null;

  // 1. Check local cache
  const cached = getCachedGif(name);
  if (cached) return cached;

  // 2. Search the API
  try {
    const encoded = encodeURIComponent(name.trim().toLowerCase());
    const url = `${API_BASE}?search=${encoded}&limit=1`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[exercise-lookup] API error ${res.status}`);
      return null;
    }

    const json = await res.json();
    const exercises = json?.data?.exercises ?? json?.data ?? [];

    if (Array.isArray(exercises) && exercises.length > 0 && exercises[0].gifUrl) {
      // 3. Download and cache the GIF locally
      const localUrl = await cacheGif(name, exercises[0].gifUrl);
      return localUrl;
    }
    return null;
  } catch (e: any) {
    console.error("[exercise-lookup] Fetch error:", e.message);
    return null;
  }
}

// Export for serving cached GIFs
export function getGifDir(): string {
  return GIF_DIR;
}
