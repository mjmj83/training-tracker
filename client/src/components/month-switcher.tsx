import { Calendar, Plus, Trash2, Copy, Pencil, ChevronsUpDown, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/confirm-dialog";
import type { Month } from "@shared/schema";

const MONTH_NAMES = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export default function MonthSwitcher() {
  const { clientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editingMonthId, setEditingMonthId] = useState<number | null>(null);
  const [editingMonthLabel, setEditingMonthLabel] = useState("");
  const [showCopyMonth, setShowCopyMonth] = useState(false);
  const [copyTargetMonth, setCopyTargetMonth] = useState(1);
  const [copyTargetYear, setCopyTargetYear] = useState(new Date().getFullYear());
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; label: string } | null>(null);

  const { data: months = [] } = useQuery<Month[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then(r => r.json()),
    enabled: !!clientId,
  });

  const selectedMonth = months.find(m => m.id === monthId);

  // Auto-select last month when client changes or months load
  useEffect(() => {
    if (clientId && months.length > 0 && !monthId) {
      const last = months[months.length - 1];
      setMonthId(last.id);
    }
  }, [clientId, months, monthId]);

  const createMonth = useMutation({
    mutationFn: (data: { clientId: number; label: string; year: number; month: number }) =>
      apiRequest("POST", "/api/months", data),
    onSuccess: async (res) => {
      const newMonth = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
      setMonthId(newMonth.id);
      setPopoverOpen(false);
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
        label: data.label, year: data.year, month: data.month,
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
            <span className="font-medium max-w-[120px] truncate">
              {selectedMonth?.label ?? "Maand..."}
            </span>
            <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-2" align="end">
          <div className="space-y-1">
            {months.map((month) => (
              <div key={month.id} className="flex items-center group">
                {editingMonthId === month.id ? (
                  <div className="flex gap-1 flex-1 px-1">
                    <Input
                      value={editingMonthLabel}
                      onChange={(e) => setEditingMonthLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingMonthLabel.trim()) {
                          updateMonthLabel.mutate({ id: month.id, label: editingMonthLabel.trim() });
                        }
                        if (e.key === "Escape") setEditingMonthId(null);
                      }}
                      onBlur={() => {
                        if (editingMonthLabel.trim()) {
                          updateMonthLabel.mutate({ id: month.id, label: editingMonthLabel.trim() });
                        } else {
                          setEditingMonthId(null);
                        }
                      }}
                      className="h-7 text-xs"
                      autoFocus
                      data-testid={`input-month-label-${month.id}`}
                    />
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => {
                      setMonthId(month.id);
                      setPopoverOpen(false);
                    }}
                    data-testid={`button-month-${month.id}`}
                  >
                    <Check className={`w-3.5 h-3.5 shrink-0 ${monthId === month.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                    <span className="flex-1 truncate">{month.label}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMonthId(month.id);
                          setEditingMonthLabel(month.label);
                        }}
                        className="hover:text-primary p-0.5"
                        data-testid={`button-edit-month-${month.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverOpen(false);
                          setCopyTargetMonth(month.month < 12 ? month.month + 1 : 1);
                          setCopyTargetYear(month.month < 12 ? month.year : month.year + 1);
                          setShowCopyMonth(true);
                        }}
                        className="hover:text-primary p-0.5"
                        data-testid={`button-copy-month-${month.id}`}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        className="hover:text-destructive p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverOpen(false);
                          setConfirmDelete({ id: month.id, label: month.label });
                        }}
                        data-testid={`button-delete-month-${month.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </button>
                )}
              </div>
            ))}
            <div className="border-t border-border pt-1 mt-1">
              <button
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={handleAddMonth}
                data-testid="button-add-month"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nieuwe maand</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Copy Month Dialog */}
      {showCopyMonth && monthId && (
        <Dialog open={showCopyMonth} onOpenChange={setShowCopyMonth}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Maand kopiëren</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select value={String(copyTargetMonth)} onValueChange={(v) => setCopyTargetMonth(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" value={copyTargetYear} onChange={(e) => setCopyTargetYear(parseInt(e.target.value))} className="w-24" />
              </div>
              <Button onClick={() => {
                copyMonth.mutate({ monthId, label: `${MONTH_NAMES[copyTargetMonth - 1]} ${copyTargetYear}`, year: copyTargetYear, month: copyTargetMonth });
              }}>Kopiëren</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Are you sure?"
        description={confirmDelete ? `"${confirmDelete.label}" wordt permanent verwijderd.` : ""}
        onConfirm={() => {
          if (confirmDelete) deleteMonthMut.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}
