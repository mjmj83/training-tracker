import { useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dumbbell, Fingerprint, KeyRound, Info } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");

  // Passkey login (discoverable credentials)
  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const optRes = await fetch(`${API_BASE}/api/auth/login/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  // PIN login
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

  // Register with email + PIN (whitelist required)
  const handleRegister = async () => {
    if (!email || !pin) return;
    if (pin.length < 4) { setError("PIN moet minimaal 4 tekens zijn"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registratie mislukt");
      if (data.verified) {
        login(data.sessionId, data.user);
      }
    } catch (e: any) {
      setError(e.message || "Registratie mislukt");
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
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setTab("login"); setError(null); }}
              data-testid="tab-login"
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "register"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setTab("register"); setError(null); }}
              data-testid="tab-register"
            >
              Register
            </button>
          </div>

          {tab === "login" ? (
            <>
              {/* Passkey login */}
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">of met e-mail</span>
                </div>
              </div>

              {/* Email + PIN login */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="je@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin" className="text-xs">PIN / Wachtwoord</Label>
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
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handlePinLogin}
                disabled={!email || !pin || loading}
                data-testid="button-pin-login"
              >
                <KeyRound className="w-4 h-4" />
                {loading ? "Bezig..." : "Inloggen"}
              </Button>
            </>
          ) : (
            <>
              {/* Register info */}
              <div className="flex items-start gap-2 bg-muted/50 rounded-md px-3 py-2.5">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Registreren is alleen mogelijk als je e-mailadres is goedgekeurd door de admin.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-xs">E-mailadres</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="je@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-register-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-pin" className="text-xs">Kies een PIN (min. 4 tekens)</Label>
                <Input
                  id="reg-pin"
                  type="password"
                  placeholder="Kies een PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email && pin) handleRegister();
                  }}
                  data-testid="input-register-pin"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleRegister}
                disabled={!email || !pin || pin.length < 4 || loading}
                data-testid="button-register"
              >
                {loading ? "Bezig..." : "Account aanmaken"}
              </Button>
            </>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
