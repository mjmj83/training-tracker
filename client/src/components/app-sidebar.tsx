import { Users, Calendar, Plus, Trash2, Copy, BarChart3, Dumbbell, Pencil, ChevronsUpDown, Check } from "lucide-react";
import { Link } from "wouter";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/confirm-dialog";
import type { Client, Month } from "@shared/schema";

const MONTH_NAMES = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export function AppSidebar() {
  const { clientId, setClientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();
  const [showCopyMonth, setShowCopyMonth] = useState(false);
  const [copyTargetMonth, setCopyTargetMonth] = useState(1);
  const [copyTargetYear, setCopyTargetYear] = useState(new Date().getFullYear());
  const [editingMonthId, setEditingMonthId] = useState<number | null>(null);
  const [editingMonthLabel, setEditingMonthLabel] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingClientName, setEditingClientName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "client" | "month";
    id: number;
    label: string;
  } | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: months = [] } = useQuery<Month[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then(r => r.json()),
    enabled: !!clientId,
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

  const createMonth = useMutation({
    mutationFn: (data: { clientId: number; label: string; year: number; month: number }) =>
      apiRequest("POST", "/api/months", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
    },
  });

  const deleteMonthMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/months/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      if (monthId === deletedId) setMonthId(null);
    },
  });

  const updateMonthLabel = useMutation({
    mutationFn: (data: { id: number; label: string }) =>
      apiRequest("PATCH", `/api/months/${data.id}`, { label: data.label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setEditingMonthId(null);
    },
  });

  const copyMonth = useMutation({
    mutationFn: (data: { monthId: number; label: string; year: number; month: number }) =>
      apiRequest("POST", `/api/months/${data.monthId}/copy`, {
        label: data.label,
        year: data.year,
        month: data.month,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      setShowCopyMonth(false);
    },
  });

  const handleAddMonth = () => {
    if (!clientId) return;
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    createMonth.mutate({
      clientId,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
      year: y,
      month: m,
    });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "client") {
      deleteClient.mutate(confirmDelete.id);
    } else {
      deleteMonthMut.mutate(confirmDelete.id);
    }
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
                            setConfirmDelete({ type: "client", id: client.id, label: client.name });
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
        {/* Months */}
        {clientId && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Maanden</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={handleAddMonth}
                data-testid="button-add-month"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {months.map((month) => (
                  <SidebarMenuItem key={month.id}>
                    <SidebarMenuButton
                      isActive={monthId === month.id}
                      onClick={() => setMonthId(month.id)}
                      data-testid={`button-month-${month.id}`}
                    >
                      <Calendar className="w-4 h-4" />
                      {editingMonthId === month.id ? (
                        <input
                          value={editingMonthLabel}
                          onChange={(e) => setEditingMonthLabel(e.target.value)}
                          onBlur={() => {
                            if (editingMonthLabel.trim()) {
                              updateMonthLabel.mutate({ id: month.id, label: editingMonthLabel.trim() });
                            } else {
                              setEditingMonthId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingMonthLabel.trim()) {
                              updateMonthLabel.mutate({ id: month.id, label: editingMonthLabel.trim() });
                            }
                            if (e.key === "Escape") setEditingMonthId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-0"
                          autoFocus
                          data-testid={`input-month-label-${month.id}`}
                        />
                      ) : (
                        <span className="flex-1 truncate">{month.label}</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMonthId(month.id);
                            setEditingMonthLabel(month.label);
                          }}
                          className="hover:text-primary"
                          data-testid={`button-edit-month-${month.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCopyTargetMonth(month.month < 12 ? month.month + 1 : 1);
                            setCopyTargetYear(month.month < 12 ? month.year : month.year + 1);
                            setShowCopyMonth(true);
                          }}
                          className="hover:text-primary"
                          data-testid={`button-copy-month-${month.id}`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          className="hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ type: "month", id: month.id, label: month.label });
                          }}
                          data-testid={`button-delete-month-${month.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigatie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/">
                    <Dumbbell className="w-4 h-4" />
                    <span>Training</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
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

      {/* Copy Month Dialog */}
      {showCopyMonth && monthId && (
        <Dialog open={showCopyMonth} onOpenChange={setShowCopyMonth}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Maand kopiëren</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select
                  value={String(copyTargetMonth)}
                  onValueChange={(v) => setCopyTargetMonth(parseInt(v))}
                >
                  <SelectTrigger data-testid="select-copy-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={copyTargetYear}
                  onChange={(e) => setCopyTargetYear(parseInt(e.target.value))}
                  className="w-24"
                  data-testid="input-copy-year"
                />
              </div>
              <Button
                onClick={() => {
                  copyMonth.mutate({
                    monthId,
                    label: `${MONTH_NAMES[copyTargetMonth - 1]} ${copyTargetYear}`,
                    year: copyTargetYear,
                    month: copyTargetMonth,
                  });
                }}
                data-testid="button-confirm-copy"
              >
                Kopiëren
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
