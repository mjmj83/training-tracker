// Module-level auth token — shared between auth context and queryClient.
// MUST be in-memory only (no localStorage/cookies — blocked in sandboxed iframe).
let authToken: string | null = null;

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}
