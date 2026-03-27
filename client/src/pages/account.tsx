import { useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, User, Plus, Trash2, Key } from "lucide-react";
import { getAuthToken } from "@/lib/auth-token";
import ConfirmDialog from "@/components/confirm-dialog";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Passkey {
  id: number;
  name: string;
  createdAt: string;
}

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Passkey | null>(null);

  const supportsPasskey = browserSupportsWebAuthn();

  // Fetch passkeys
  const { data: passkeys = [] } = useQuery<Passkey[]>({
    queryKey: ["/api/auth/passkeys"],
    queryFn: () => apiRequest("GET", "/api/auth/passkeys").then(r => r.json()),
  });

  // Delete passkey
  const deletePasskey = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/auth/passkeys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/passkeys"] });
      setConfirmDelete(null);
      toast({ title: "Passkey verwijderd" });
    },
  });

  // Step 1: ask for name, step 2: do the WebAuthn flow
  const startRegisterFlow = () => {
    setPasskeyName("");
    setShowNameDialog(true);
    setError(null);
  };

  const handlePasskeyRegister = async () => {
    if (!passkeyName.trim()) return;
    setShowNameDialog(false);
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
        body: JSON.stringify({ sessionId, response: regResponse, name: passkeyName.trim() }),
      });
      if (!verRes.ok) {
        const data = await verRes.json();
        throw new Error(data.error || "Registratie mislukt");
      }
      const result = await verRes.json();
      if (result.verified) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/passkeys"] });
        toast({ title: "Passkey geregistreerd", description: `"${passkeyName.trim()}" is toegevoegd.` });
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

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    } catch { return iso; }
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-primary" />
                Passkeys ({passkeys.length})
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={startRegisterFlow}
                disabled={loading}
                data-testid="button-add-passkey"
              >
                <Plus className="w-3.5 h-3.5" />
                Toevoegen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Log in met je vingerafdruk, gezichtsherkenning of beveiligingssleutel.
            </p>

            {passkeys.length > 0 ? (
              <div className="space-y-2">
                {passkeys.map(pk => (
                  <div
                    key={pk.id}
                    className="flex items-center gap-3 bg-muted/50 rounded-md px-3 py-2 group"
                  >
                    <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pk.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(pk.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(pk)}
                      className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      data-testid={`button-delete-passkey-${pk.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                Geen passkeys geregistreerd.
              </p>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Name dialog for new passkey */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Passkey toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Naam voor deze passkey</Label>
            <Input
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder="Bijv. MacBook Touch ID"
              className="text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && passkeyName.trim()) handlePasskeyRegister();
              }}
              data-testid="input-passkey-name"
            />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handlePasskeyRegister}
              disabled={!passkeyName.trim()}
              className="text-xs"
              data-testid="button-confirm-passkey"
            >
              Doorgaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Passkey verwijderen?"
        description={confirmDelete ? `"${confirmDelete.name}" wordt permanent verwijderd. Je kunt altijd een nieuwe registreren.` : ""}
        onConfirm={() => {
          if (confirmDelete) deletePasskey.mutate(confirmDelete.id);
        }}
      />
    </div>
  );
}
