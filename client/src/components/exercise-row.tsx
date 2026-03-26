import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Unlink, MessageCircleWarning, BarChart3, Settings, MoreVertical, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onSwapSupersetOrder?: () => void;
}

export default function ExerciseRow({
  exercise, weightLogs, monthId, weekCount,
  isSuperset, isFirstInSuperset, isLastInSuperset,
  isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onBeforeChange,
  hoveredWeek, onWeekHover,
  readOnly = false,
  onMoveUp, onMoveDown, canMoveUp = false, canMoveDown = false,
  onSwapSupersetOrder,
}: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(String(exercise.sets));
  const [goalReps, setGoalReps] = useState(String(exercise.goalReps));
  const [tempo, setTempo] = useState(exercise.tempo ?? "");
  const [rest, setRest] = useState(String(exercise.rest ?? 60));
  const [rir, setRir] = useState(exercise.rir ?? "");
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [weightType, setWeightType] = useState(exercise.weightType ?? "weighted");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [showSettings, setShowSettings] = useState(false);

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

  // Inline helper to render a settings badge (not a component to avoid focus loss on re-render)
  const renderBadge = (label: string, value: string | number, onChange: (v: string) => void, onFieldBlur: () => void, field: string, opts?: { type?: string; inputWidth?: string; min?: number; placeholder?: string }) => {
    const { type, inputWidth = "w-6", min, placeholder } = opts || {};
    return (
      <div className="flex items-center gap-0.5" key={field}>
        <span className="text-xs text-muted-foreground">{label}</span>
        {readOnly ? (
          <span className="text-[13px] font-medium">{value || "—"}</span>
        ) : (
          <input
            type="text"
            inputMode={type === "number" ? "numeric" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              if (type === "number") {
                const trimmed = e.target.value.trim();
                if (trimmed === "") {
                  if (field === "sets" || field === "rest") {
                    onChange(String(min ?? 1));
                  }
                } else {
                  const num = parseInt(trimmed);
                  if (!isNaN(num)) onChange(String(num));
                }
              }
              onFieldBlur();
            }}
            placeholder={placeholder}
            className={`${inputWidth} text-[13px] text-center bg-muted/50 border border-border rounded px-1 py-0 h-[22px] outline-none focus:ring-1 focus:ring-primary`}
            data-testid={`input-${field}-${exercise.id}`}
          />
        )}
      </div>
    );
  };

  return (
    <tr
      className={`hover:bg-muted/50 transition-colors group bg-card/60 ${supersetClass} ${dragOverClass}`}
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
      <td className="py-1.5 px-2 border border-border border-r-0 rounded-l-[5px]">
        {/* Line 1: Exercise name */}
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => { if (!readOnly) setName(e.target.value); }}
              onBlur={() => handleBlur("name", name)}
              className={`flex-1 min-w-0 bg-transparent border-none outline-none text-[15px] font-semibold ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}`}
              readOnly={readOnly}
              data-testid={`input-exercise-name-${exercise.id}`}
            />
          </div>
        </div>

        {/* Line 2: Settings badges */}
        <div className="flex gap-2 items-center mt-2">
          {renderBadge("sets", sets, setSets, () => handleBlur("sets", sets), "sets", { type: "number", inputWidth: "w-6", min: 1 })}
          {renderBadge("reps", goalReps, setGoalReps, () => handleBlur("goalReps", goalReps), "reps", { inputWidth: "w-10", placeholder: "10" })}
          {renderBadge("tempo", tempo, setTempo, () => handleBlur("tempo", tempo), "tempo", { inputWidth: "w-8", placeholder: "—" })}
          {renderBadge("rest", rest, setRest, () => handleBlur("rest", rest), "rest", { type: "number", inputWidth: "w-8", min: 5 })}
          {renderBadge("rir", rir, setRir, () => handleBlur("rir", rir), "rir", { inputWidth: "w-6", placeholder: "—" })}
        </div>

        {/* Line 3: Notes — always shown */}
        {!readOnly ? (
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={() => { setEditingNotes(notes); setShowNotesDialog(true); }}
              className={`shrink-0 ${hasNotes ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              data-testid={`button-notes-${exercise.id}`}
            >
              <MessageCircleWarning className="w-3.5 h-3.5" />
            </button>
            {hasNotes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground italic truncate max-w-[260px] cursor-default leading-tight">
                    {notes}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">{notes}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : hasNotes ? (
          <div className="flex items-center gap-1 mt-2">
            <MessageCircleWarning className="w-3.5 h-3.5 text-primary shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground italic truncate max-w-[260px] cursor-default leading-tight">{notes}</p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">{notes}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </td>

      {/* Weight columns */}
      {weeks.map((weekNum, idx) => {
        const isLastWeek = idx === weeks.length - 1;
        const needsRightBorder = isLastWeek && readOnly;
        return (
        <td
          key={weekNum}
          className={`py-1 px-1 w-[110px] max-w-[110px] transition-colors border-y border-border ${needsRightBorder ? "border-r border-border rounded-r-[5px]" : ""} ${hoveredWeek === weekNum ? "bg-primary/10" : ""}`}
          onMouseEnter={() => onWeekHover(weekNum)}
          onMouseLeave={() => onWeekHover(null)}
        >
          <div className="flex flex-col items-center gap-0.5">
            {Array.from({ length: parseInt(String(sets)) || 3 }, (_, i) => i + 1).map((setNum) => {
              const log = getLog(weekNum, setNum);
              const prevLog = setNum > 1 ? getLog(weekNum, setNum - 1) : null;
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
                  previousWeight={prevLog?.weight}
                  previousReps={prevLog?.reps}
                  weightType={weightType}
                />
              );
            })}
          </div>
        </td>
        );
      })}

      {/* Menu column — far right */}
      {!readOnly && (
        <td className="py-1 px-1 w-8 align-top border border-border border-l-0 rounded-r-[5px]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground/40 hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" data-testid={`button-menu-${exercise.id}`}>
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
                <Settings className="w-4 h-4 mr-2" />
                Instellingen
              </DropdownMenuItem>
              {isSuperset && (
                <DropdownMenuItem onClick={() => { onBeforeChange(); unSuperset.mutate(); }}>
                  <Unlink className="w-4 h-4 mr-2" />
                  Superset opheffen
                </DropdownMenuItem>
              )}
              {isSuperset && onSwapSupersetOrder && (
                <DropdownMenuItem onClick={onSwapSupersetOrder}>
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Volgorde wisselen in superset
                </DropdownMenuItem>
              )}
              {canMoveUp && onMoveUp && (
                <DropdownMenuItem onClick={onMoveUp}>
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Omhoog verplaatsen
                </DropdownMenuItem>
              )}
              {canMoveDown && onMoveDown && (
                <DropdownMenuItem onClick={onMoveDown}>
                  <ArrowDown className="w-4 h-4 mr-2" />
                  Omlaag verplaatsen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>



          {/* Chart icon — under menu icon, hover visible */}
          <button
            onClick={() => setShowChart(true)}
            className="text-muted-foreground/40 hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center justify-center w-full"
            data-testid={`button-chart-${exercise.id}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </td>
      )}

      {/* Hidden td for dialogs and chart */}
      <td className="p-0 w-0 border-0">
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
        {/* Settings Dialog */}
        {!readOnly && (
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="sm:max-w-[300px]">
              <DialogHeader>
                <DialogTitle className="text-sm">Instellingen — {exercise.name}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 py-2">
                <Switch
                  id={`weight-toggle-${exercise.id}`}
                  checked={weightType === "weighted"}
                  onCheckedChange={(checked) => {
                    const newType = checked ? "weighted" : "reps_only";
                    setWeightType(newType);
                    onBeforeChange();
                    updateExercise.mutate({ weightType: newType });
                  }}
                  data-testid={`toggle-weight-type-${exercise.id}`}
                />
                <Label htmlFor={`weight-toggle-${exercise.id}`} className="text-sm cursor-pointer">
                  Gewicht
                </Label>
              </div>
            </DialogContent>
          </Dialog>
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
