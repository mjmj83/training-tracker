import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NotebookPen, Save, Plus, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import ConfirmDialog from "@/components/confirm-dialog";

interface NoteTab {
  id: number;
  clientId: number;
  name: string;
  content: string;
  sortOrder: number;
}

interface Props {
  clientId: number;
}

export default function ClientNotepad({ clientId }: Props) {
  const { toast } = useToast();
  const isTrainer = useIsTrainer();
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rename dialog
  const [renameDialog, setRenameDialog] = useState<{ id: number; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<NoteTab | null>(null);

  const { data: tabs = [] } = useQuery<NoteTab[]>({
    queryKey: ["/api/clients", clientId, "note-tabs"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/note-tabs`).then(r => r.json()),
  });

  // Auto-select first tab
  useEffect(() => {
    if (tabs.length > 0 && (!activeTabId || !tabs.find(t => t.id === activeTabId))) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  // Sync content when tab changes
  const activeTab = tabs.find(t => t.id === activeTabId);
  useEffect(() => {
    if (activeTab) {
      setContent(activeTab.content ?? "");
      setHasUnsaved(false);
    }
  }, [activeTabId, activeTab?.content]);

  const updateTab = useMutation({
    mutationFn: (data: { id: number; content?: string; name?: string }) =>
      apiRequest("PATCH", `/api/note-tabs/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "note-tabs"] });
      setHasUnsaved(false);
    },
  });

  const createTab = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", `/api/clients/${clientId}/note-tabs`, { name }),
    onSuccess: async (res) => {
      const newTab = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "note-tabs"] });
      setActiveTabId(newTab.id);
    },
  });

  const deleteTab = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/note-tabs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "note-tabs"] });
      setConfirmDelete(null);
    },
  });

  const handleContentChange = (value: string) => {
    if (!isTrainer) return;
    setContent(value);
    setHasUnsaved(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (activeTabId) updateTab.mutate({ id: activeTabId, content: value });
    }, 1500);
  };

  const handleManualSave = () => {
    if (!activeTabId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    updateTab.mutate({ id: activeTabId, content });
    toast({ title: "Opgeslagen" });
  };

  const handleRename = () => {
    if (!renameDialog || !renameName.trim()) return;
    updateTab.mutate({ id: renameDialog.id, name: renameName.trim() });
    setRenameDialog(null);
  };

  return (
    <div className="flex flex-col h-full" data-testid="client-notepad">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Klantnotities</h2>
        </div>
        {isTrainer && (
          <div className="flex items-center gap-2">
            {hasUnsaved && (
              <span className="text-[10px] text-muted-foreground">Niet opgeslagen</span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              className="h-7 px-2 text-xs gap-1"
              data-testid="button-save-client-notes"
            >
              <Save className="w-3.5 h-3.5" />
              Opslaan
            </Button>
          </div>
        )}
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-0.5 px-6 pt-3 pb-0 overflow-x-auto">
        {tabs
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(tab => (
            <div
              key={tab.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-md text-xs cursor-pointer transition-colors group border border-b-0 ${
                activeTabId === tab.id
                  ? "bg-card border-border text-foreground font-medium"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => {
                // Save current tab before switching
                if (hasUnsaved && activeTabId) {
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  updateTab.mutate({ id: activeTabId, content });
                }
                setActiveTabId(tab.id);
              }}
              data-testid={`tab-note-${tab.id}`}
            >
              <span className="truncate max-w-[120px]">{tab.name}</span>
              {isTrainer && activeTabId === tab.id && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameName(tab.name);
                      setRenameDialog({ id: tab.id, name: tab.name });
                    }}
                    className="text-muted-foreground/50 hover:text-foreground p-0.5"
                    data-testid={`button-rename-tab-${tab.id}`}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(tab);
                      }}
                      className="text-muted-foreground/50 hover:text-destructive p-0.5"
                      data-testid={`button-delete-tab-${tab.id}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        {isTrainer && (
          <button
            onClick={() => createTab.mutate("Nieuw tabje")}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-add-note-tab"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Notepad area */}
      <div className="flex-1 px-6 pb-6">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={isTrainer ? "Notities voor deze klant..." : ""}
          className="w-full h-full min-h-[300px] bg-card border border-border rounded-b-md rounded-tr-md p-4 text-sm leading-relaxed outline-none resize-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          readOnly={!isTrainer}
          data-testid="textarea-client-notes"
        />
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => { if (!open) setRenameDialog(null); }}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Tab hernoemen</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="Naam..."
            className="text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
            data-testid="input-rename-tab"
          />
          <DialogFooter>
            <Button size="sm" onClick={handleRename} disabled={!renameName.trim()} className="text-xs">
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Tab verwijderen?"
        description={confirmDelete ? `"${confirmDelete.name}" wordt permanent verwijderd met alle inhoud.` : ""}
        onConfirm={() => {
          if (confirmDelete) deleteTab.mutate(confirmDelete.id);
        }}
      />
    </div>
  );
}
