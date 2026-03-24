import { Calendar, Plus, Trash2, Copy, Pencil, ChevronsUpDown, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Month } from "@shared/schema";

export default function MonthSwitcher() {
  const { clientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; label: string } | null>(null);

  // Dialog state for create/edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "copy">("create");
  const [dialogBlockId, setDialogBlockId] = useState<number | null>(null);
  const [dialogLabel, setDialogLabel] = useState("");
  const [dialogStartDate, setDialogStartDate] = useState("");
  const [dialogWeekCount, setDialogWeekCount] = useState(4);

  const { data: months = [] } = useQuery<Month[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then(r => r.json()),
    enabled: !!clientId,
  });

  // Sort by startDate (newest first for display, but keep original order for auto-select)
  const sortedMonths = [...months].sort((a, b) => {
    const da = a.startDate || "";
    const db = b.startDate || "";
    return db.localeCompare(da); // newest first
  });

  const selectedMonth = months.find(m => m.id === monthId);

  // Auto-select latest block when client changes
  useEffect(() => {
    if (clientId && months.length > 0 && !monthId) {
      const latest = sortedMonths[0]; // newest by startDate
      if (latest) setMonthId(latest.id);
    }
  }, [clientId, months, monthId]);

  const createMonth = useMutation({
    mutationFn: (data: { clientId: number; label: string; year: number; month: number; weekCount: number; startDate: string }) =>
      apiRequest("POST", "/api/months", data),
    onSuccess: async (res) => {
      const newMonth = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      setMonthId(newMonth.id);
      setPopoverOpen(false);
      setDialogOpen(false);
    },
  });

  const deleteMonthMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/months/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      if (monthId === deletedId) setMonthId(null);
    },
  });

  const updateMonth = useMutation({
    mutationFn: (data: { id: number; label?: string; startDate?: string; weekCount?: number }) =>
      apiRequest("PATCH", `/api/months/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setDialogOpen(false);
    },
  });

  const copyMonth = useMutation({
    mutationFn: (data: { monthId: number; label: string; year: number; month: number; weekCount?: number; startDate?: string }) =>
      apiRequest("POST", `/api/months/${data.monthId}/copy`, {
        label: data.label, year: data.year, month: data.month, weekCount: data.weekCount, startDate: data.startDate,
      }),
    onSuccess: async (res) => {
      const newMonth = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      setMonthId(newMonth.id);
      setDialogOpen(false);
    },
  });

  const openCreateDialog = () => {
    const today = new Date().toISOString().split("T")[0];
    setDialogMode("create");
    setDialogBlockId(null);
    setDialogLabel("");
    setDialogStartDate(today);
    setDialogWeekCount(4);
    setPopoverOpen(false);
    setDialogOpen(true);
  };

  const openEditDialog = (month: Month) => {
    setDialogMode("edit");
    setDialogBlockId(month.id);
    setDialogLabel(month.label);
    setDialogStartDate(month.startDate || "");
    setDialogWeekCount(month.weekCount);
    setPopoverOpen(false);
    setDialogOpen(true);
  };

  const openCopyDialog = (month: Month) => {
    const today = new Date().toISOString().split("T")[0];
    setDialogMode("copy");
    setDialogBlockId(month.id);
    setDialogLabel(`${month.label} (kopie)`);
    setDialogStartDate(today);
    setDialogWeekCount(month.weekCount);
    setPopoverOpen(false);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!dialogLabel.trim() || !dialogStartDate) return;
    const d = new Date(dialogStartDate);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    if (dialogMode === "create" && clientId) {
      createMonth.mutate({
        clientId,
        label: dialogLabel.trim(),
        year,
        month,
        weekCount: dialogWeekCount,
        startDate: dialogStartDate,
      });
    } else if (dialogMode === "edit" && dialogBlockId) {
      updateMonth.mutate({
        id: dialogBlockId,
        label: dialogLabel.trim(),
        startDate: dialogStartDate,
        weekCount: dialogWeekCount,
      });
    } else if (dialogMode === "copy" && dialogBlockId) {
      copyMonth.mutate({
        monthId: dialogBlockId,
        label: dialogLabel.trim(),
        year,
        month,
        weekCount: dialogWeekCount,
        startDate: dialogStartDate,
      });
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  };

  if (!clientId) return null;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
            data-testid="button-month-switcher"
          >
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium max-w-[160px] truncate">
              {selectedMonth?.label ?? "Trainingsblok..."}
            </span>
            <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="end">
          <div className="space-y-1">
            {sortedMonths.map((month) => (
              <div key={month.id} className="flex items-center group">
                <button
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    setMonthId(month.id);
                    setPopoverOpen(false);
                  }}
                  data-testid={`button-month-${month.id}`}
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${monthId === month.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{month.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {month.startDate ? formatDate(month.startDate) : `${month.year}`} · {month.weekCount} weken
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditDialog(month); }}
                      className="hover:text-primary p-0.5"
                      data-testid={`button-edit-month-${month.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openCopyDialog(month); }}
                      className="hover:text-primary p-0.5"
                      data-testid={`button-copy-month-${month.id}`}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopoverOpen(false);
                        setConfirmDelete({ id: month.id, label: month.label });
                      }}
                      className="hover:text-destructive p-0.5"
                      data-testid={`button-delete-month-${month.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              </div>
            ))}
            <div className="border-t border-border pt-1 mt-1">
              <button
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={openCreateDialog}
                data-testid="button-add-month"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trainingsblok toevoegen</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create/Edit/Copy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "create" ? "Trainingsblok toevoegen" : dialogMode === "edit" ? "Trainingsblok wijzigen" : "Trainingsblok kopiëren"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Naam</Label>
              <Input
                value={dialogLabel}
                onChange={(e) => setDialogLabel(e.target.value)}
                placeholder="bijv. Krachtblok, Vakantie Ibiza..."
                className="text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleDialogSave(); }}
                data-testid="input-dialog-block-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Begindatum</Label>
              <Input
                type="date"
                value={dialogStartDate}
                onChange={(e) => setDialogStartDate(e.target.value)}
                className="text-sm"
                data-testid="input-dialog-block-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aantal weken</Label>
              <div className="flex gap-1 flex-wrap">
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDialogWeekCount(n)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      dialogWeekCount === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`button-dialog-weeks-${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleDialogSave}
              disabled={!dialogLabel.trim() || !dialogStartDate}
              className="text-xs"
              data-testid="button-dialog-save-block"
            >
              {dialogMode === "create" ? "Toevoegen" : dialogMode === "copy" ? "Kopiëren" : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Trainingsblok verwijderen?"
        description={confirmDelete ? `"${confirmDelete.label}" wordt permanent verwijderd.` : ""}
        onConfirm={() => {
          if (confirmDelete) deleteMonthMut.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}
