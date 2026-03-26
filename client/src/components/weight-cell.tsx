import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircleWarning } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  exerciseId: number;
  weekNumber: number;
  setNumber: number;
  initialWeight: number | null;
  initialReps: number | null;
  initialNotes: string;
  monthId: number;
  onBeforeChange?: () => void;
  readOnly?: boolean;
}

export default function WeightCell({
  exerciseId, weekNumber, setNumber,
  initialWeight, initialReps, initialNotes, monthId, onBeforeChange,
  readOnly = false,
}: Props) {
  const [weight, setWeight] = useState(initialWeight !== null ? String(initialWeight) : "");
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");

  const upsertLog = useMutation({
    mutationFn: (data: { weight: number | null; reps: number | null; notes?: string }) =>
      apiRequest("POST", "/api/weight-logs", {
        exerciseId, weekNumber, setNumber,
        weight: data.weight, reps: data.reps, notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const handleBlur = useCallback(() => {
    if (readOnly) return;
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps) : null;
    if (w !== initialWeight || r !== initialReps) {
      onBeforeChange?.();
      upsertLog.mutate({ weight: w, reps: r });
    }
  }, [weight, reps, initialWeight, initialReps, readOnly]);

  const hasNotes = notes && notes.trim().length > 0;

  return (
    <>
      <div
        className="group/cell flex items-center gap-0.5 rounded bg-muted/40 px-1 py-0.5 relative"
        data-testid={`weight-cell-${exerciseId}-w${weekNumber}-s${setNumber}`}
      >
        <input
          value={weight}
          onChange={(e) => { if (!readOnly) setWeight(e.target.value); }}
          onBlur={handleBlur}
          placeholder="kg"
          className="w-[36px] bg-transparent border-none outline-none text-center text-sm tabular-nums font-mono"
          readOnly={readOnly}
          data-testid={`input-weight-${exerciseId}-w${weekNumber}-s${setNumber}`}
        />
        <span className="text-muted-foreground text-xs">x</span>
        <input
          value={reps}
          onChange={(e) => { if (!readOnly) setReps(e.target.value); }}
          onBlur={handleBlur}
          placeholder="r"
          className="w-[24px] bg-transparent border-none outline-none text-center text-sm tabular-nums font-mono"
          readOnly={readOnly}
          data-testid={`input-reps-${exerciseId}-w${weekNumber}-s${setNumber}`}
        />
        {/* Notes icon */}
        {!readOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setEditingNotes(notes);
                  setShowNotesDialog(true);
                }}
                className={`shrink-0 ml-0.5 transition-opacity ${
                  hasNotes
                    ? "text-primary opacity-100"
                    : "text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100"
                }`}
                data-testid={`button-set-notes-${exerciseId}-w${weekNumber}-s${setNumber}`}
              >
                <MessageCircleWarning className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {hasNotes ? notes : "Opmerking toevoegen"}
            </TooltipContent>
          </Tooltip>
        ) : hasNotes ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 ml-0.5 text-primary">
                <MessageCircleWarning className="w-3 h-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {notes}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {/* Notes Dialog — only for trainers */}
      {!readOnly && (
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-sm">
                Opmerking — Set {setNumber}, W{weekNumber}
                {weight && reps ? ` (${weight} x ${reps})` : ""}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Bijv. 'Voelde zwaar, form breakdown bij laatste rep'"
              className="min-h-[80px] text-sm"
              data-testid={`textarea-set-notes-${exerciseId}-w${weekNumber}-s${setNumber}`}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNotesDialog(false)}>
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onBeforeChange?.();
                  setNotes(editingNotes);
                  const w = weight ? parseFloat(weight) : null;
                  const r = reps ? parseInt(reps) : null;
                  upsertLog.mutate({ weight: w, reps: r, notes: editingNotes });
                  setShowNotesDialog(false);
                }}
                data-testid={`button-save-set-notes-${exerciseId}-w${weekNumber}-s${setNumber}`}
              >
                Opslaan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
