import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { getAuthToken, setAuthToken } from "./auth-token";
import { queryClient } from "./queryClient";

interface AuthContextValue {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  login: (sessionId: string, user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid session");
      })
      .then((data) => {
        setUser(data.user);
        setSessionId(token);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
        setSessionId(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newSessionId: string, newUser: User) => {
    setAuthToken(newSessionId);
    setSessionId(newSessionId);
    setUser(newUser);
    queryClient.clear(); // Clear all cached data from previous user
  }, []);

  const logout = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    setAuthToken(null);
    setSessionId(null);
    setUser(null);
    queryClient.clear(); // Clear all cached data
  }, []);

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
