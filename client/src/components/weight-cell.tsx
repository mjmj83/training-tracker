import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircleWarning, X } from "lucide-react";
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
  initialSkipped: number;
  initialNotes: string;
  monthId: number;
  onBeforeChange?: () => void;
  readOnly?: boolean;
  previousWeight?: number | null;
  previousReps?: number | null;
  weightType?: string;
  trackingType?: string;
}

export default function WeightCell({
  exerciseId, weekNumber, setNumber,
  initialWeight, initialReps, initialSkipped, initialNotes, monthId, onBeforeChange,
  readOnly = false,
  previousWeight,
  previousReps,
  weightType,
  trackingType,
}: Props) {
  const isRepsOnly = weightType === "reps_only" || weightType === "bodyweight";
  const isTimeBased = trackingType === "time";
  const [weight, setWeight] = useState(initialWeight !== null ? String(initialWeight) : "");
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : "");
  const [skipped, setSkipped] = useState(!!initialSkipped);
  const [notes, setNotes] = useState(initialNotes || "");
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");

  const upsertLog = useMutation({
    mutationFn: (data: { weight: number | null; reps: number | null; skipped?: number; notes?: string }) =>
      apiRequest("POST", "/api/weight-logs", {
        exerciseId, weekNumber, setNumber,
        weight: data.weight, reps: data.reps, skipped: data.skipped, notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes("all-blocks") });
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

  const handleWeightFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!readOnly && weight === "" && previousWeight != null) {
      const val = String(previousWeight);
      setWeight(val);
      // Select text after React renders the new value
      requestAnimationFrame(() => e.target.select());
    }
  };
  const handleRepsFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!readOnly && reps === "" && previousReps != null) {
      const val = String(previousReps);
      setReps(val);
      requestAnimationFrame(() => e.target.select());
    }
  };

  // Format display value for locked/readOnly cells
  const displayValue = (() => {
    if (skipped) return "skip";
    const hasW = weight !== "";
    const hasR = reps !== "";
    if (!isRepsOnly && hasW && hasR) return `${weight} x ${reps}`;
    if (!isRepsOnly && hasW) return weight;
    if (hasR) return reps;
    return "";
  })();

  return (
    <>
      <div
        className={`group/cell flex items-center justify-center gap-0.5 rounded px-1 py-0.5 relative ${readOnly ? "" : skipped ? "bg-muted/30" : "bg-muted/60"}`}
        data-testid={`weight-cell-${exerciseId}-w${weekNumber}-s${setNumber}`}
      >
        {readOnly ? (
          <span className={`text-sm tabular-nums font-mono text-center ${skipped ? "text-muted-foreground/40 line-through italic text-xs" : !displayValue ? "text-muted-foreground/20" : ""}`}>
            {skipped ? "skip" : displayValue || "\u00b7"}
          </span>
        ) : skipped ? (
          <span className="text-xs text-muted-foreground/50 italic w-full text-center">skip</span>
        ) : (
          <>
            {!isRepsOnly && (
              <>
                <input
                  value={weight}
                  onChange={(e) => { if (!readOnly) setWeight(e.target.value); }}
                  onBlur={handleBlur}
                  onFocus={handleWeightFocus}
                  placeholder={previousWeight != null ? String(previousWeight) : "kg"}
                  className="w-[36px] bg-transparent border-none outline-none text-center text-sm tabular-nums font-mono"
                  readOnly={readOnly}
                  data-testid={`input-weight-${exerciseId}-w${weekNumber}-s${setNumber}`}
                />
                <span className="text-muted-foreground text-xs">x</span>
              </>
            )}
            <input
              value={reps}
              onChange={(e) => { if (!readOnly) setReps(e.target.value); }}
              onBlur={handleBlur}
              onFocus={handleRepsFocus}
              placeholder={previousReps != null ? String(previousReps) : (isTimeBased ? "s" : "r")}
              className={`bg-transparent border-none outline-none text-center text-sm tabular-nums font-mono ${isRepsOnly ? "w-[36px]" : "w-[24px]"}`}
              readOnly={readOnly}
              data-testid={`input-reps-${exerciseId}-w${weekNumber}-s${setNumber}`}
            />
          </>
        )}
        {/* Skip + Notes icons */}
        {!readOnly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const newSkipped = !skipped;
                  setSkipped(newSkipped);
                  onBeforeChange?.();
                  const w = weight ? parseFloat(weight) : null;
                  const r = reps ? parseInt(reps) : null;
                  upsertLog.mutate({ weight: w, reps: r, skipped: newSkipped ? 1 : 0 });
                }}
                className={`shrink-0 ml-0.5 transition-opacity ${
                  skipped
                    ? "text-destructive/60 opacity-100"
                    : "text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100"
                }`}
                data-testid={`button-skip-${exerciseId}-w${weekNumber}-s${setNumber}`}
              >
                <X className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {skipped ? "Unskip" : "Set overslaan"}
            </TooltipContent>
          </Tooltip>
        )}
        {!readOnly && !skipped ? (
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
        ) : !readOnly ? null : hasNotes ? (
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
                Opmerking — Set {setNumber}, Week {weekNumber}
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
