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
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
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
        setError("Passkey geannuleerd door gebruiker");
      } else {
        setError(e.message || "Inloggen mislukt");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
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

          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="Voer je PIN in"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email && pin) handlePinLogin();
              }}
              data-testid="input-login-pin"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={handlePinLogin}
            disabled={!email || !pin || loading}
            data-testid="button-pin-login"
          >
            <KeyRound className="w-4 h-4" />
            {loading ? "Bezig..." : "Inloggen"}
          </Button>

          {supportsPasskey && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wide">of gebruik een passkey</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handlePasskeyLogin}
                  disabled={!email || loading}
                  data-testid="button-passkey-login"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Inloggen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handlePasskeyRegister}
                  disabled={!email || loading}
                  data-testid="button-passkey-register"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Registreren
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
