import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, GripVertical, Unlink, MessageCircleWarning, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import WeightCell from "@/components/weight-cell";
import ConfirmDialog from "@/components/confirm-dialog";
import ExerciseChartDialog from "@/components/exercise-chart-dialog";
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
  hoveredWeek: number | null;
  onWeekHover: (week: number | null) => void;
  readOnly?: boolean;
}

export default function ExerciseRow({
  exercise, weightLogs, monthId, weekCount,
  isSuperset, isFirstInSuperset, isLastInSuperset,
  isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onBeforeChange,
  hoveredWeek, onWeekHover,
  readOnly = false,
}: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [goalReps, setGoalReps] = useState(exercise.goalReps);
  const [tempo, setTempo] = useState(exercise.tempo ?? "");
  const [rest, setRest] = useState(exercise.rest ?? 60);
  const [rir, setRir] = useState(exercise.rir ?? "");
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChart, setShowChart] = useState(false);
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
      if (readOnly) return;
      onBeforeChange();
      updateExercise.mutate({ [field]: value });
    },
    [updateExercise, onBeforeChange, readOnly]
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

  // Settings badge component
  const SettingsBadge = ({ label, value, onChange, onFieldBlur, field, type, inputWidth = "w-6", min, max, step, placeholder }: {
    label: string;
    value: string | number;
    onChange: (v: any) => void;
    onFieldBlur: () => void;
    field: string;
    type?: string;
    inputWidth?: string;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
  }) => (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {readOnly ? (
        <span className="text-[11px] font-medium">{value || "—"}</span>
      ) : (
        <input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            if (type === "number") {
              onChange(parseInt(e.target.value) || (min ?? 1));
            } else {
              onChange(e.target.value);
            }
          }}
          onBlur={onFieldBlur}
          placeholder={placeholder}
          className={`${inputWidth} text-[11px] text-center bg-muted/50 border border-border rounded px-1 py-0 h-5 outline-none focus:ring-1 focus:ring-primary`}
          data-testid={`input-${field}-${exercise.id}`}
        />
      )}
    </div>
  );

  return (
    <tr
      className={`border-b border-border/50 hover:bg-muted/30 transition-colors group ${supersetClass} ${dragOverClass}`}
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      data-testid={`exercise-row-${exercise.id}`}
    >
      {/* Exercise info block — single td with stacked lines */}
      <td className="py-1 px-2">
        {/* Line 1: Exercise name + actions */}
        <div className="flex items-center gap-1">
          {!readOnly && (
            <GripVertical className="w-3 h-3 text-muted-foreground/40 cursor-grab shrink-0" />
          )}
          {isSuperset && (
            <span className="text-[9px] text-primary font-bold shrink-0 mr-0.5">SS</span>
          )}
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={(e) => { if (!readOnly) setName(e.target.value); }}
              onBlur={() => handleBlur("name", name)}
              className="w-full bg-transparent border-none outline-none text-xs font-medium"
              readOnly={readOnly}
              data-testid={`input-exercise-name-${exercise.id}`}
            />
          </div>
          {/* Notes alert icon */}
          {!readOnly && (
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
          )}
          {/* Action buttons on hover */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon" variant="ghost"
                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                  onClick={() => setShowChart(true)}
                  data-testid={`button-chart-${exercise.id}`}
                >
                  <BarChart3 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Bekijk chart</TooltipContent>
            </Tooltip>
            {!readOnly && isSuperset && (
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
            {!readOnly && (
              <Button
                size="icon" variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                data-testid={`button-delete-exercise-${exercise.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Line 2: Settings badges */}
        <div className="flex gap-2 items-center mt-0.5">
          <SettingsBadge
            label="sets" value={sets}
            onChange={setSets} onFieldBlur={() => handleBlur("sets", sets)}
            field="sets" type="number" inputWidth="w-6" min={1} max={5}
          />
          <SettingsBadge
            label="reps" value={goalReps}
            onChange={setGoalReps} onFieldBlur={() => handleBlur("goalReps", goalReps)}
            field="reps" type="number" inputWidth="w-6" min={1} max={15}
          />
          <SettingsBadge
            label="tempo" value={tempo}
            onChange={setTempo} onFieldBlur={() => handleBlur("tempo", tempo)}
            field="tempo" inputWidth="w-8" placeholder="—"
          />
          <SettingsBadge
            label="rest" value={rest}
            onChange={setRest} onFieldBlur={() => handleBlur("rest", rest)}
            field="rest" type="number" inputWidth="w-8" min={5} max={90} step={5}
          />
          <SettingsBadge
            label="rir" value={rir}
            onChange={setRir} onFieldBlur={() => handleBlur("rir", rir)}
            field="rir" inputWidth="w-6" placeholder="—"
          />
        </div>

        {/* Line 3: Notes (only if notes exist) */}
        {hasNotes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[10px] text-muted-foreground italic truncate max-w-[240px] cursor-default leading-tight mt-0.5">
                {notes}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">
              {notes}
            </TooltipContent>
          </Tooltip>
        )}
      </td>

      {/* Weight columns */}
      {weeks.map((weekNum) => (
        <td
          key={weekNum}
          className={`py-1 px-1 transition-colors ${hoveredWeek === weekNum ? "bg-primary/10" : ""}`}
          onMouseEnter={() => onWeekHover(weekNum)}
          onMouseLeave={() => onWeekHover(null)}
        >
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
                  readOnly={readOnly}
                />
              );
            })}
          </div>
        </td>
      ))}

      {/* Hidden td for dialogs and chart */}
      <td className="py-1 px-1 w-0">
        {!readOnly && (
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
        )}
        {/* Notes Dialog — trainers only */}
        {!readOnly && (
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
        )}
        <ExerciseChartDialog
          exerciseName={showChart ? exercise.name : null}
          open={showChart}
          onOpenChange={setShowChart}
        />
      </td>
    </tr>
  );
}
