import { useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, User, CheckCircle2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth-token";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);

  const supportsPasskey = browserSupportsWebAuthn();

  const handlePasskeyRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = getAuthToken();
      const optRes = await fetch(`${API_BASE}/api/auth/register/options`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
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
        setPasskeyRegistered(true);
        toast({ title: "Passkey geregistreerd", description: "Je kunt nu inloggen met je passkey." });
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

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Account</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Accountgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">E-mail</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Naam</span>
            <span className="text-sm">{user?.displayName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Rol</span>
            <span className="text-sm capitalize">{user?.role}</span>
          </div>
        </CardContent>
      </Card>

      {supportsPasskey && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-primary" />
              Passkey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Met een passkey kun je inloggen zonder PIN. Gebruik je vingerafdruk, gezichtsherkenning of een beveiligingssleutel.
            </p>

            {passkeyRegistered ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Passkey succesvol geregistreerd</span>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handlePasskeyRegister}
                disabled={loading}
                data-testid="button-register-passkey"
              >
                <Fingerprint className="w-4 h-4" />
                {loading ? "Bezig..." : "Passkey registreren"}
              </Button>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
