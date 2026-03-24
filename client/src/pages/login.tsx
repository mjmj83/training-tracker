import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dumbbell } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleLogin = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      // Step 1: get authentication options
      const optRes = await fetch(`${API_BASE}/api/auth/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        throw new Error(data.error || "Fout bij ophalen login opties");
      }
      const { options, sessionId } = await optRes.json();

      // Step 2: browser WebAuthn ceremony
      const authResponse = await startAuthentication({ optionsJSON: options });

      // Step 3: verify on server
      const verRes = await fetch(`${API_BASE}/api/auth/login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, response: authResponse }),
      });
      if (!verRes.ok) {
        const data = await verRes.json();
        throw new Error(data.error || "Verificatie mislukt");
      }
      const result = await verRes.json();
      if (result.verified) {
        login(result.sessionId, result.user);
      }
    } catch (e: any) {
      setError(e.message || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      // Step 1: get registration options
      const optRes = await fetch(`${API_BASE}/api/auth/register/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        throw new Error(data.error || "Fout bij ophalen registratie opties");
      }
      const { options, sessionId } = await optRes.json();

      // Step 2: browser WebAuthn ceremony
      const regResponse = await startRegistration({ optionsJSON: options });

      // Step 3: verify on server
      const verRes = await fetch(`${API_BASE}/api/auth/register/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, response: regResponse }),
      });
      if (!verRes.ok) {
        const data = await verRes.json();
        throw new Error(data.error || "Registratie mislukt");
      }
      const result = await verRes.json();
      if (result.verified) {
        login(result.sessionId, result.user);
      }
    } catch (e: any) {
      setError(e.message || "Registratie mislukt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-lg">Training Tracker</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Log in met je passkey"
              : "Registreer een nieuwe passkey"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              placeholder="trainer@training.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) {
                  mode === "login" ? handleLogin() : handleRegister();
                }
              }}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 rounded-md px-3 py-2">
              {success}
            </div>
          )}

          {mode === "login" ? (
            <>
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!email || loading}
              >
                {loading ? "Bezig..." : "Inloggen met passkey"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Passkey registreren
                </button>
              </div>
            </>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={handleRegister}
                disabled={!email || loading}
              >
                {loading ? "Bezig..." : "Passkey registreren"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Terug naar inloggen
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
