import { Users, Plus, Trash2, BarChart3, Dumbbell, Pencil, ChevronsUpDown, Check, NotebookPen, Settings, Calculator, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/confirm-dialog";
import type { Client } from "@shared/schema";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { clientId, setClientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();
  const [location] = useLocation();
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    label: string;
  } | null>(null);

  // Client form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogClientId, setDialogClientId] = useState<number | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogGender, setDialogGender] = useState<"male" | "female">("male");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const selectedClient = clients.find(c => c.id === clientId);

  const createClient = useMutation({
    mutationFn: (data: { name: string; gender: string }) => apiRequest("POST", "/api/clients", data),
    onSuccess: async (res) => {
      const newClient = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientId(newClient.id);
      setClientPopoverOpen(false);
      setDialogOpen(false);
    },
  });

  const deleteClient = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientId(null);
    },
  });

  const updateClient = useMutation({
    mutationFn: (data: { id: number; name?: string; gender?: string }) => {
      const body: Record<string, string> = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.gender !== undefined) body.gender = data.gender;
      return apiRequest("PATCH", `/api/clients/${data.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialogOpen(false);
    },
  });

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteClient.mutate(confirmDelete.id);
    setConfirmDelete(null);
  };

  const openCreateDialog = () => {
    setDialogMode("create");
    setDialogClientId(null);
    setDialogName("");
    setDialogGender("male");
    setDialogOpen(true);
  };

  const openEditDialog = (client: Client) => {
    setDialogMode("edit");
    setDialogClientId(client.id);
    setDialogName(client.name);
    setDialogGender((client.gender as "male" | "female") || "male");
    setClientPopoverOpen(false);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!dialogName.trim()) return;
    if (dialogMode === "create") {
      createClient.mutate({ name: dialogName.trim(), gender: dialogGender });
    } else if (dialogClientId) {
      updateClient.mutate({ id: dialogClientId, name: dialogName.trim(), gender: dialogGender });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm flex-1">Training Tracker</span>
          <Link href="/settings">
            <button
              className={`p-1 rounded transition-colors ${location === "/settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="button-global-settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* Client Switcher */}
        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              data-testid="button-client-switcher"
            >
              <Users className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate font-medium">
                {selectedClient?.name ?? "Selecteer klant..."}
              </span>
              <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2" align="start">
            <div className="space-y-1">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center group">
                  <button
                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => {
                      setClientId(client.id);
                      setClientPopoverOpen(false);
                    }}
                    data-testid={`button-client-${client.id}`}
                  >
                    <Check className={`w-3.5 h-3.5 shrink-0 ${clientId === client.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                    <span className="flex-1 truncate">{client.name}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {client.gender === "male" ? "M" : "V"}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(client);
                        }}
                        className="hover:text-primary p-0.5"
                        data-testid={`button-edit-client-${client.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClientPopoverOpen(false);
                          setConfirmDelete({ id: client.id, label: client.name });
                        }}
                        className="hover:text-destructive p-0.5"
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </button>
                </div>
              ))}
              <div className="border-t border-border pt-1 mt-1 px-1">
                <button
                  onClick={openCreateDialog}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  data-testid="button-add-client"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nieuwe klant</span>
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Client sub-links */}
        {clientId && (
          <div className="space-y-0.5 mt-1.5">
            <Link href="/notes">
              <button
                className={`flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs transition-colors ${
                  location === "/notes"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
                data-testid="button-notes"
              >
                <NotebookPen className="w-3.5 h-3.5" />
                <span>Klantnotities</span>
              </button>
            </Link>
            <Link href="/abc">
              <button
                className={`flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs transition-colors ${
                  location === "/abc"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
                data-testid="button-abc"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Vetpercentage</span>
              </button>
            </Link>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigatie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/" && !!clientId}>
                  <Link href="/">
                    <Dumbbell className="w-4 h-4" />
                    <span>Training</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/charts")}>
                  <Link href="/charts">
                    <BarChart3 className="w-4 h-4" />
                    <span>Charts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User / Logout */}
      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {user?.email}
          </span>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Uitloggen"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Client create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "create" ? "Nieuwe klant" : "Klant wijzigen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Naam</Label>
              <Input
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                placeholder="Klantnaam..."
                className="text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDialogSave();
                }}
                data-testid="input-dialog-client-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geslacht</Label>
              <div className="flex gap-1">
                <button
                  onClick={() => setDialogGender("male")}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                    dialogGender === "male" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  data-testid="button-dialog-gender-male"
                >
                  Man
                </button>
                <button
                  onClick={() => setDialogGender("female")}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                    dialogGender === "female" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  data-testid="button-dialog-gender-female"
                >
                  Vrouw
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleDialogSave}
              disabled={!dialogName.trim()}
              className="text-xs"
              data-testid="button-dialog-save-client"
            >
              {dialogMode === "create" ? "Toevoegen" : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Klant verwijderen?"
        description={confirmDelete ? `"${confirmDelete.label}" wordt permanent verwijderd met alle bijbehorende data.` : ""}
        onConfirm={handleConfirmDelete}
      />
    </Sidebar>
  );
}
