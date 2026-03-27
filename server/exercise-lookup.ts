import fs from "fs";
import path from "path";

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

interface ExerciseEntry {
  name: string;
  id: string;
  images: string[];
  primaryMuscles?: string[];
  equipment?: string;
}

let exerciseDb: ExerciseEntry[] = [];

// Load exercise database
const dbPath = path.join(__dirname, "exercise-db.json");
// In production (bundled), the JSON might be alongside the bundle or need a different path
const altPath = path.join(process.cwd(), "server", "exercise-db.json");
const altPath2 = path.join(process.cwd(), "exercise-db.json");
const altPath3 = path.join(process.cwd(), "dist", "exercise-db.json");

for (const p of [dbPath, altPath, altPath2, altPath3]) {
  try {
    if (fs.existsSync(p)) {
      exerciseDb = JSON.parse(fs.readFileSync(p, "utf-8"));
      console.log(`[exercise-lookup] Loaded ${exerciseDb.length} exercises from ${p}`);
      break;
    }
  } catch (e) {
    console.error(`[exercise-lookup] Failed to load from ${p}:`, e);
  }
}

if (exerciseDb.length === 0) {
  console.warn("[exercise-lookup] No exercise database loaded — image lookup will be disabled");
}

// Simple fuzzy matching: normalized lowercase, remove common prefixes/suffixes, Levenshtein-like scoring
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  
  // Exact match
  if (na === nb) return 1;
  
  // Contains match
  if (nb.includes(na) || na.includes(nb)) return 0.8;
  
  // Word overlap scoring
  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  let matchingWords = 0;
  for (const wa of wordsA) {
    if (wa.length < 2) continue;
    for (const wb of wordsB) {
      if (wb.includes(wa) || wa.includes(wb)) {
        matchingWords++;
        break;
      }
    }
  }
  const maxWords = Math.max(wordsA.length, wordsB.length);
  return maxWords > 0 ? matchingWords / maxWords * 0.7 : 0;
}

export function findExerciseImage(name: string): string | null {
  if (exerciseDb.length === 0 || !name) return null;
  
  let bestMatch: ExerciseEntry | null = null;
  let bestScore = 0;
  
  for (const ex of exerciseDb) {
    const score = similarity(name, ex.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = ex;
    }
  }
  
  // Only return if we have a reasonable match (>= 0.4)
  if (bestMatch && bestScore >= 0.4 && bestMatch.images?.length > 0) {
    return IMAGE_BASE + bestMatch.images[0];
  }
  
  return null;
}
