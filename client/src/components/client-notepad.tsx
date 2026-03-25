import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NotebookPen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import type { Client } from "@shared/schema";

interface Props {
  clientId: number;
}

export default function ClientNotepad({ clientId }: Props) {
  const { toast } = useToast();
  const isTrainer = useIsTrainer();
  const [notes, setNotes] = useState("");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}`).then((r) => r.json()),
  });

  // Sync notes from server when client data loads
  useEffect(() => {
    if (client) {
      setNotes(client.notes ?? "");
      setHasUnsaved(false);
    }
  }, [client]);

  const updateNotes = useMutation({
    mutationFn: (newNotes: string) =>
      apiRequest("PATCH", `/api/clients/${clientId}`, { notes: newNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setHasUnsaved(false);
    },
  });

  const handleChange = (value: string) => {
    if (!isTrainer) return;
    setNotes(value);
    setHasUnsaved(true);

    // Auto-save after 1.5s of inactivity
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateNotes.mutate(value);
    }, 1500);
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    updateNotes.mutate(notes);
    toast({ title: "Opgeslagen", description: "Klantnotities zijn opgeslagen." });
  };

  return (
    <div className="flex flex-col h-full" data-testid="client-notepad">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">{client?.name ?? "..."} — Notities</h2>
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

      {/* Notepad area */}
      <div className="flex-1 p-6">
        <textarea
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isTrainer ? "Algemene informatie over de klant...\n\nBijv. blessures, doelen, aandachtspunten, contactgegevens, etc." : ""}
          className="w-full h-full min-h-[300px] bg-transparent border border-border rounded-md p-4 text-sm leading-relaxed outline-none resize-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          readOnly={!isTrainer}
          data-testid="textarea-client-notes"
        />
      </div>
    </div>
  );
}
