import { useState } from "react";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dumbbell, Fingerprint, KeyRound } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");

  // Passkey login without email (discoverable credentials)
  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const optRes = await fetch(`${API_BASE}/api/auth/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // no email = discoverable credentials
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        throw new Error(data.error || "Fout bij ophalen login opties");
      }
      const { options, sessionId } = await optRes.json();
      const authResponse = await startAuthentication({ optionsJSON: options });
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
      if (e.name === "NotAllowedError") {
        setError("Passkey geannuleerd");
      } else {
        setError(e.message || "Inloggen mislukt");
      }
    } finally {
      setLoading(false);
    }
  };

  // PIN login with email
  const handlePinLogin = async () => {
    if (!email || !pin) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/pin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inloggen mislukt");
      if (data.verified) {
        login(data.sessionId, data.user);
      }
    } catch (e: any) {
      setError(e.message || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  // Passkey registration (needs email)
  const handlePasskeyRegister = async () => {
    if (!email) { setError("Vul een e-mailadres in"); return; }
    setError(null);
    setLoading(true);
    try {
      const optRes = await fetch(`${API_BASE}/api/auth/register/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        throw new Error(data.error || "Fout bij registratie opties");
      }
      const { options, sessionId } = await optRes.json();
      const regResponse = await startRegistration({ optionsJSON: options });
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
      if (e.name === "NotAllowedError") {
        setError("Passkey registratie geannuleerd");
      } else {
        setError(e.message || "Registratie mislukt");
      }
    } finally {
      setLoading(false);
    }
  };

  const supportsPasskey = browserSupportsWebAuthn();

  // Default view: passkey login (no email needed)
  if (!showPinLogin && !showRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <Dumbbell className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-lg">Training Tracker</CardTitle>
            <CardDescription>Log in om verder te gaan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            {supportsPasskey && (
              <Button
                className="w-full gap-2"
                onClick={handlePasskeyLogin}
                disabled={loading}
                data-testid="button-passkey-login"
              >
                <Fingerprint className="w-4 h-4" />
                {loading ? "Bezig..." : "Inloggen met passkey"}
              </Button>
            )}

            <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-border">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                onClick={() => { setShowPinLogin(true); setError(null); }}
              >
                <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> Inloggen met PIN</span>
              </button>
              {supportsPasskey && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  onClick={() => { setShowRegister(true); setError(null); }}
                >
                  Passkey registreren
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PIN login view or Passkey registration view
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-lg">Training Tracker</CardTitle>
          <CardDescription>
            {showRegister ? "Registreer een passkey" : "Inloggen met PIN"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              placeholder="je@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              data-testid="input-login-email"
            />
          </div>

          {showPinLogin && (
            <div className="space-y-2">
              <Label htmlFor="pin">PIN / Wachtwoord</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Voer je PIN in"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email && pin) handlePinLogin();
                }}
                data-testid="input-login-pin"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {showPinLogin ? (
            <Button
              className="w-full gap-2"
              onClick={handlePinLogin}
              disabled={!email || !pin || loading}
              data-testid="button-pin-login"
            >
              <KeyRound className="w-4 h-4" />
              {loading ? "Bezig..." : "Inloggen"}
            </Button>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={handlePasskeyRegister}
              disabled={!email || loading}
              data-testid="button-passkey-register"
            >
              <Fingerprint className="w-4 h-4" />
              {loading ? "Bezig..." : "Passkey registreren"}
            </Button>
          )}

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              onClick={() => {
                setShowPinLogin(false);
                setShowRegister(false);
                setError(null);
              }}
            >
              Terug
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
