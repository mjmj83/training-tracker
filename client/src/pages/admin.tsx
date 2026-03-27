import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Shield, Users, Dumbbell, Trash2, Plus, Mail } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface WhitelistEntry {
  id: number;
  email: string;
  role: string;
  createdAt: string;
}

interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
  clientName: string | null;
  trainerEmail: string | null;
  ownedClientCount: number;
  ownedClientNames: string[];
}

export default function AdminPage() {
  const { user } = useAuth();
  const isAdminUser = user?.email === "mariusjansen@gmail.com";

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; email: string } | null>(null);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState("");
  const [newWhitelistRole, setNewWhitelistRole] = useState("trainer");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then(r => r.json()),
    enabled: isAdminUser,
  });

  const { data: whitelist = [] } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/admin/whitelist"],
    queryFn: () => apiRequest("GET", "/api/admin/whitelist").then(r => r.json()),
    enabled: isAdminUser,
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDelete(null);
    },
  });

  const addWhitelist = useMutation({
    mutationFn: (data: { email: string; role: string }) => apiRequest("POST", "/api/admin/whitelist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
      setNewWhitelistEmail("");
    },
  });

  const removeWhitelist = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
    },
  });

  if (!isAdminUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Shield className="w-10 h-10 opacity-30" />
        <p className="text-sm">Geen toegang</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  const trainers = users.filter(u => u.role === "trainer");
  const clients = users.filter(u => u.role === "client");

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Admin Panel</h1>
      </div>

      {/* Email Whitelist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            E-mail Whitelist ({whitelist.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Alleen gewhiteliste e-mailadressen kunnen een account aanmaken.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="email@voorbeeld.nl"
              value={newWhitelistEmail}
              onChange={(e) => setNewWhitelistEmail(e.target.value)}
              className="text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newWhitelistEmail.trim()) {
                  addWhitelist.mutate({ email: newWhitelistEmail.trim(), role: newWhitelistRole });
                }
              }}
              data-testid="input-whitelist-email"
            />
            <select
              value={newWhitelistRole}
              onChange={(e) => setNewWhitelistRole(e.target.value)}
              className="text-sm border border-border rounded-md px-2 bg-background"
              data-testid="select-whitelist-role"
            >
              <option value="trainer">Trainer</option>
              <option value="client">Client</option>
            </select>
            <Button
              size="sm"
              onClick={() => {
                if (newWhitelistEmail.trim()) {
                  addWhitelist.mutate({ email: newWhitelistEmail.trim(), role: newWhitelistRole });
                }
              }}
              disabled={!newWhitelistEmail.trim()}
              data-testid="button-add-whitelist"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {whitelist.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">E-mail</TableHead>
                  <TableHead className="text-xs">Rol</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelist.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">{w.email}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs capitalize">{w.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => removeWhitelist.mutate(w.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Trainers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            Trainers ({trainers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trainers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen trainers gevonden</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Naam</TableHead>
                  <TableHead className="text-xs">E-mail</TableHead>
                  <TableHead className="text-xs">Klanten</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                    <TableCell className="text-sm">
                      {t.ownedClientCount > 0 ? (
                        <span className="text-muted-foreground">
                          {t.ownedClientCount} — {t.ownedClientNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">Geen</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.email !== "mariusjansen@gmail.com" && (
                        <button onClick={() => setConfirmDelete({ id: t.id, email: t.email })} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Client users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Klant-logins ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen klant-logins gevonden</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Naam</TableHead>
                  <TableHead className="text-xs">E-mail</TableHead>
                  <TableHead className="text-xs">Klant</TableHead>
                  <TableHead className="text-xs">Trainer</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-sm">
                      {c.clientName ? (
                        <Badge variant="outline" className="text-xs">{c.clientName}</Badge>
                      ) : (
                        <span className="text-muted-foreground/50">Niet gekoppeld</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.trainerEmail || "—"}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => setConfirmDelete({ id: c.id, email: c.email })} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Gebruiker verwijderen?"
        description={confirmDelete ? `"${confirmDelete.email}" wordt permanent verwijderd inclusief alle passkeys en sessies.` : ""}
        onConfirm={() => {
          if (confirmDelete) deleteUser.mutate(confirmDelete.id);
        }}
      />
    </div>
  );
}
