import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, GripVertical, Unlink, MessageCircleWarning, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import WeightCell from "@/components/weight-cell";
import ConfirmDialog from "@/components/confirm-dialog";
import type { Exercise, WeightLog } from "@shared/schema";

interface Props {
  exercise: Exercise;
  weightLogs: WeightLog[];
  monthId: number;
  weekCount: number;
  isSuperset: boolean;
  isFirstInSuperset: boolean;
  isLastInSuperset: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onBeforeChange: () => void;
}

export default function ExerciseRow({
  exercise, weightLogs, monthId, weekCount,
  isSuperset, isFirstInSuperset, isLastInSuperset,
  isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onBeforeChange,
}: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [goalReps, setGoalReps] = useState(exercise.goalReps);
  const [tempo, setTempo] = useState(exercise.tempo ?? "");
  const [rest, setRest] = useState(exercise.rest ?? 60);
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");

  const updateExercise = useMutation({
    mutationFn: (data: Partial<Exercise>) =>
      apiRequest("PATCH", `/api/exercises/${exercise.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const deleteExercise = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/exercises/${exercise.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const unSuperset = useMutation({
    mutationFn: () => apiRequest("POST", `/api/exercises/${exercise.id}/unsuperset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const handleBlur = useCallback(
    (field: string, value: any) => {
      onBeforeChange();
      updateExercise.mutate({ [field]: value });
    },
    [updateExercise, onBeforeChange]
  );

  const getLog = (weekNumber: number, setNumber: number): WeightLog | undefined => {
    return weightLogs.find(
      (l) => l.weekNumber === weekNumber && l.setNumber === setNumber
    );
  };

  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);
  const hasNotes = notes && notes.trim().length > 0;

  // Superset styling
  let supersetClass = "";
  if (isSuperset) {
    supersetClass = "bg-primary/5 ";
    if (isFirstInSuperset) supersetClass += "border-t-2 border-t-primary/30 ";
    if (isLastInSuperset) supersetClass += "border-b-2 border-b-primary/30 ";
    if (!isLastInSuperset) supersetClass += "border-b-0 ";
  }

  const dragOverClass = isDragOver ? "ring-2 ring-primary ring-inset" : "";

  return (
    <tr
      className={`border-b border-border/50 hover:bg-muted/30 transition-colors group ${supersetClass} ${dragOverClass}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      data-testid={`exercise-row-${exercise.id}`}
    >
      {/* Drag handle + Exercise Name + Notes */}
      <td className="py-1 px-2">
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab shrink-0" />
          {isSuperset && (
            <span className="text-[9px] text-primary font-bold shrink-0 mr-0.5">SS</span>
          )}
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur("name", name)}
              className="w-full bg-transparent border-none outline-none text-xs font-medium"
              data-testid={`input-exercise-name-${exercise.id}`}
            />
            {/* Personal notes under the name — truncated with tooltip on hover */}
            {hasNotes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[180px] cursor-default leading-tight">
                    {notes}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">
                  {notes}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Notes alert icon — tooltip shows notes, click opens edit */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setEditingNotes(notes);
                  setShowNotesDialog(true);
                }}
                className={`shrink-0 transition-opacity ${
                  hasNotes
                    ? "text-primary opacity-100"
                    : "text-muted-foreground/40 opacity-0 group-hover:opacity-100"
                }`}
                data-testid={`button-notes-${exercise.id}`}
              >
                <MessageCircleWarning className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {hasNotes ? notes : "Opmerking toevoegen"}
            </TooltipContent>
          </Tooltip>
        </div>
      </td>

      {/* Sets */}
      <td className="py-1 px-1 text-center">
        <input
          type="number" min={1} max={5} value={sets}
          onChange={(e) => setSets(parseInt(e.target.value) || 1)}
          onBlur={() => handleBlur("sets", sets)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-sets-${exercise.id}`}
        />
      </td>

      {/* Goal Reps */}
      <td className="py-1 px-1 text-center">
        <input
          type="number" min={1} max={15} value={goalReps}
          onChange={(e) => setGoalReps(parseInt(e.target.value) || 1)}
          onBlur={() => handleBlur("goalReps", goalReps)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-reps-${exercise.id}`}
        />
      </td>

      {/* Tempo */}
      <td className="py-1 px-1 text-center">
        <input
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          onBlur={() => handleBlur("tempo", tempo)}
          className="w-full bg-transparent border-none outline-none text-center text-xs"
          placeholder="—"
          data-testid={`input-tempo-${exercise.id}`}
        />
      </td>

      {/* Rest */}
      <td className="py-1 px-1 text-center">
        <input
          type="number" min={5} max={90} step={5} value={rest}
          onChange={(e) => setRest(parseInt(e.target.value) || 60)}
          onBlur={() => handleBlur("rest", rest)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-rest-${exercise.id}`}
        />
      </td>

      {/* Weight columns */}
      {weeks.map((weekNum) => (
        <td key={weekNum} className="py-1 px-1">
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: sets }, (_, i) => i + 1).map((setNum) => {
              const log = getLog(weekNum, setNum);
              return (
                <WeightCell
                  key={`${weekNum}-${setNum}`}
                  exerciseId={exercise.id}
                  weekNumber={weekNum}
                  setNumber={setNum}
                  initialWeight={log?.weight ?? null}
                  initialReps={log?.reps ?? null}
                  initialNotes={log?.notes ?? ""}
                  monthId={monthId}
                  onBeforeChange={onBeforeChange}
                />
              );
            })}
          </div>
        </td>
      ))}

      {/* Actions */}
      <td className="py-1 px-1">
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/charts/${encodeURIComponent(exercise.name)}`}>
                <Button
                  size="icon" variant="ghost"
                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                  data-testid={`button-chart-${exercise.id}`}
                >
                  <BarChart3 className="w-3 h-3" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Bekijk chart</TooltipContent>
          </Tooltip>
          {isSuperset && (
            <Button
              size="icon" variant="ghost"
              className="h-5 w-5 text-muted-foreground hover:text-primary"
              onClick={() => { onBeforeChange(); unSuperset.mutate(); }}
              title="Superset opheffen"
              data-testid={`button-unsuperset-${exercise.id}`}
            >
              <Unlink className="w-3 h-3" />
            </Button>
          )}
          <Button
            size="icon" variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            data-testid={`button-delete-exercise-${exercise.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Are you sure?"
          description={`"${exercise.name}" wordt verwijderd met alle ingevulde gewichtsdata.`}
          onConfirm={() => {
            onBeforeChange();
            deleteExercise.mutate();
            setShowDeleteConfirm(false);
          }}
        />
        {/* Notes Dialog */}
        <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-sm">Opmerking — {exercise.name}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Bijv. 'Let op de houding van de bovenrug'"
              className="min-h-[80px] text-sm"
              data-testid={`textarea-notes-${exercise.id}`}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotesDialog(false)}
              >
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onBeforeChange();
                  setNotes(editingNotes);
                  updateExercise.mutate({ notes: editingNotes });
                  setShowNotesDialog(false);
                }}
                data-testid={`button-save-notes-${exercise.id}`}
              >
                Opslaan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
