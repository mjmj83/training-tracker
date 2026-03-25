// Auth token storage — tries localStorage first, falls back to in-memory.
// localStorage works on Railway/custom domains but is blocked in sandboxed iframes.

const STORAGE_KEY = "tt_session";
let memoryToken: string | null = null;

function canUseLocalStorage(): boolean {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

const useLS = canUseLocalStorage();

export function getAuthToken(): string | null {
  if (useLS) {
    return localStorage.getItem(STORAGE_KEY);
  }
  return memoryToken;
}

export function setAuthToken(token: string | null): void {
  memoryToken = token;
  if (useLS) {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
