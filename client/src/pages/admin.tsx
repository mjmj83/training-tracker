import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Shield, Users, Dumbbell, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then(r => r.json()),
    enabled: user?.email === "mariusjansen@gmail.com",
  });

  if (user?.email !== "mariusjansen@gmail.com") {
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

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; email: string } | null>(null);

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDelete(null);
    },
  });

  const trainers = users.filter(u => u.role === "trainer");
  const clients = users.filter(u => u.role === "client");

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Admin Panel</h1>
      </div>

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
