import { Users, Plus, Trash2, BarChart3, Dumbbell, Pencil, ChevronsUpDown, Check, NotebookPen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import ConfirmDialog from "@/components/confirm-dialog";
import type { Client } from "@shared/schema";

export function AppSidebar() {
  const { clientId, setClientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();
  const [location, navigate] = useLocation();
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingClientName, setEditingClientName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    label: string;
  } | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const selectedClient = clients.find(c => c.id === clientId);

  const createClient = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/clients", { name }),
    onSuccess: async (res) => {
      const newClient = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setNewClientName("");
      setClientId(newClient.id);
      setClientPopoverOpen(false);
    },
  });

  const deleteClient = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientId(null);
    },
  });

  const updateClientName = useMutation({
    mutationFn: (data: { id: number; name: string }) =>
      apiRequest("PATCH", `/api/clients/${data.id}`, { name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditingClientId(null);
    },
  });

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    deleteClient.mutate(confirmDelete.id);
    setConfirmDelete(null);
  };

  return (
    <Sidebar>
      {/* Header: Logo + Client Name with Switcher */}
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Training Tracker</span>
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
                  {editingClientId === client.id ? (
                    <div className="flex gap-1 flex-1 px-1">
                      <Input
                        value={editingClientName}
                        onChange={(e) => setEditingClientName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingClientName.trim()) {
                            updateClientName.mutate({ id: client.id, name: editingClientName.trim() });
                          }
                          if (e.key === "Escape") setEditingClientId(null);
                        }}
                        onBlur={() => {
                          if (editingClientName.trim()) {
                            updateClientName.mutate({ id: client.id, name: editingClientName.trim() });
                          } else {
                            setEditingClientId(null);
                          }
                        }}
                        className="h-7 text-xs"
                        autoFocus
                        data-testid={`input-client-name-${client.id}`}
                      />
                    </div>
                  ) : (
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
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClientId(client.id);
                            setEditingClientName(client.name);
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
                  )}
                </div>
              ))}

              {/* Add new client */}
              <div className="border-t border-border pt-1 mt-1">
                <div className="flex gap-1 px-1">
                  <Input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Nieuwe klant..."
                    className="h-7 text-xs"
                    data-testid="input-new-client"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newClientName.trim()) {
                        createClient.mutate(newClientName.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => newClientName.trim() && createClient.mutate(newClientName.trim())}
                    disabled={!newClientName.trim()}
                    data-testid="button-save-client"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigatie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/" && !!monthId}>
                  <Link href="/">
                    <Dumbbell className="w-4 h-4" />
                    <span>Training</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location === "/" && !monthId && !!clientId}
                  onClick={() => { if (clientId) { setMonthId(null); navigate("/"); } }}
                >
                  <NotebookPen className="w-4 h-4" />
                  <span>Notities</span>
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Are you sure?"
        description={confirmDelete ? `"${confirmDelete.label}" wordt permanent verwijderd met alle bijbehorende data.` : ""}
        onConfirm={handleConfirmDelete}
      />
    </Sidebar>
  );
}
