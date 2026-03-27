import { Users, Plus, Trash2, BarChart3, Dumbbell, Pencil, ChevronsUpDown, Check, NotebookPen, Settings, Calculator, LogOut, KeyRound, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useAuth } from "@/lib/auth";
import { useIsTrainer } from "@/hooks/use-is-trainer";
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

interface ClientUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
  clientId: number | null;
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const isTrainer = useIsTrainer();
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
  const [dialogBfReminder, setDialogBfReminder] = useState(true);

  // Client login dialog state
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginClientId, setLoginClientId] = useState<number | null>(null);
  const [loginClientName, setLoginClientName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch client users (only for trainers)
  const { data: clientUsers = [] } = useQuery<ClientUser[]>({
    queryKey: ["/api/auth/client-users"],
    queryFn: () => apiRequest("GET", "/api/auth/client-users").then(r => r.json()),
    enabled: isTrainer,
  });

  const selectedClient = clients.find(c => c.id === clientId);

  // Auto-select client for client users
  useEffect(() => {
    if (!isTrainer && user?.clientId && clientId !== user.clientId) {
      setClientId(user.clientId);
    }
  }, [isTrainer, user?.clientId, clientId, setClientId]);

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
    mutationFn: (data: { id: number; name?: string; gender?: string; bfReminderEnabled?: number }) => {
      const body: Record<string, string | number> = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.gender !== undefined) body.gender = data.gender;
      if (data.bfReminderEnabled !== undefined) body.bfReminderEnabled = data.bfReminderEnabled;
      return apiRequest("PATCH", `/api/clients/${data.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialogOpen(false);
    },
  });

  const createClientUser = useMutation({
    mutationFn: (data: { email: string; pin: string; clientId: number; displayName: string }) =>
      apiRequest("POST", "/api/auth/create-client-user", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/client-users"] });
      setLoginDialogOpen(false);
      setLoginEmail("");
      setLoginPin("");
      setLoginError("");
    },
    onError: (error: Error) => {
      try {
        const msg = error.message?.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(msg);
        setLoginError(parsed.error || "Er ging iets mis");
      } catch {
        setLoginError(error.message?.replace(/^\d+:\s*/, "") || "Er ging iets mis");
      }
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
    setDialogBfReminder(!!client.bfReminderEnabled);
    setClientPopoverOpen(false);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!dialogName.trim()) return;
    if (dialogMode === "create") {
      createClient.mutate({ name: dialogName.trim(), gender: dialogGender });
    } else if (dialogClientId) {
      updateClient.mutate({ id: dialogClientId, name: dialogName.trim(), gender: dialogGender, bfReminderEnabled: dialogBfReminder ? 1 : 0 });
    }
  };

  const openLoginDialog = (client: Client) => {
    setLoginClientId(client.id);
    setLoginClientName(client.name);
    setLoginEmail("");
    setLoginPin("");
    setLoginError("");
    setClientPopoverOpen(false);
    setLoginDialogOpen(true);
  };

  const handleCreateLogin = () => {
    if (!loginEmail.trim() || !loginPin.trim() || !loginClientId) return;
    createClientUser.mutate({
      email: loginEmail.trim(),
      pin: loginPin.trim(),
      clientId: loginClientId,
      displayName: loginClientName,
    });
  };

  const getClientUser = (cId: number) => clientUsers.find(cu => cu.clientId === cId);

  return (
    <Sidebar>
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm flex-1">Training Tracker</span>
          {isTrainer && (
            <Link href="/settings">
              <button
                className={`p-1 rounded transition-colors ${location === "/settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="button-global-settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </Link>
          )}
        </div>

        {/* Client Switcher */}
        {isTrainer ? (
          <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-2 w-full rounded-md border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors text-left"
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
                {clients.map((client) => {
                  const existingUser = getClientUser(client.id);
                  return (
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
                              openLoginDialog(client);
                            }}
                            className={`p-0.5 ${existingUser ? "text-primary" : "hover:text-primary"}`}
                            title={existingUser ? `Login: ${existingUser.email}` : "Klant login aanmaken"}
                            data-testid={`button-login-client-${client.id}`}
                          >
                            <KeyRound className="w-3 h-3" />
                          </button>
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
                  );
                })}
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
        ) : (
          /* Client user: show static client name, no popover */
          <div
            className="flex items-center gap-2 w-full rounded-md border border-border px-3 py-2 text-sm text-left"
            data-testid="button-client-switcher"
          >
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium">
              {selectedClient?.name ?? "Laden..."}
            </span>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/notes"}>
                  <Link href="/notes">
                    <NotebookPen className="w-4 h-4" />
                    <span>Klantnotities</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/abc"}>
                  <Link href="/abc">
                    <Calculator className="w-4 h-4" />
                    <span>Body Composition</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Admin link + User / Logout */}
      <div className="mt-auto border-t border-border p-3 space-y-2">
        {user?.email === "mariusjansen@gmail.com" && (
          <Link href="/admin">
            <button
              className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs transition-colors ${
                location === "/admin"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              data-testid="button-admin"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Link href="/account">
            <button
              className={`text-xs truncate flex-1 transition-colors ${location === "/account" ? "text-sidebar-foreground font-medium" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
              title="Account instellingen"
              data-testid="button-account"
            >
              {user?.email}
            </button>
          </Link>
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
          {dialogMode === "edit" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Body Composition reminder</Label>
              <div className="flex items-center gap-2">
                <Switch checked={dialogBfReminder} onCheckedChange={setDialogBfReminder} />
                <span className="text-xs text-muted-foreground">
                  {dialogBfReminder ? "Herinnering actief (na 30 dagen)" : "Herinnering uitgeschakeld"}
                </span>
              </div>
            </div>
          )}
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

      {/* Client login dialog (trainers only) */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Login voor klant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Klant</Label>
              <Input
                value={loginClientName}
                disabled
                className="text-sm bg-muted"
              />
            </div>
            {loginClientId && getClientUser(loginClientId) ? (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Login bestaat al:</span>{" "}
                {getClientUser(loginClientId)!.email}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="klant@email.com"
                    className="text-sm"
                    autoFocus
                    data-testid="input-login-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PIN (min. 4 tekens)</Label>
                  <Input
                    type="text"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    placeholder="1234"
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateLogin();
                    }}
                    data-testid="input-login-pin"
                  />
                </div>
                {loginError && (
                  <div className="text-xs text-destructive">{loginError}</div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            {loginClientId && !getClientUser(loginClientId) && (
              <Button
                size="sm"
                onClick={handleCreateLogin}
                disabled={!loginEmail.trim() || loginPin.trim().length < 4}
                className="text-xs"
                data-testid="button-create-login"
              >
                Account aanmaken
              </Button>
            )}
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
