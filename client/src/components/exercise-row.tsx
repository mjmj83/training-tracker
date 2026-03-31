import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Unlink, MessageCircleWarning, BarChart3, Settings, MoreVertical, ArrowUp, ArrowDown, ArrowUpDown, ImageIcon, Search, Check, Upload, Info } from "lucide-react";
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
  lockedWeeks?: Set<number>;
}

export default function ExerciseRow({
  exercise, weightLogs, monthId, weekCount,
  isSuperset, isFirstInSuperset, isLastInSuperset,
  isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onBeforeChange,
  hoveredWeek, onWeekHover, lockedWeeks,
  readOnly = false,
  onMoveUp, onMoveDown, canMoveUp = false, canMoveDown = false,
  onSwapSupersetOrder,
}: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(String(exercise.sets ?? "3"));
  const [goalReps, setGoalReps] = useState(String(exercise.goalReps ?? "10"));
  const [tempo, setTempo] = useState(exercise.tempo ?? "");
  const [rest, setRest] = useState(String(exercise.rest ?? "60"));
  const [rir, setRir] = useState(exercise.rir ?? "");
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [weightType, setWeightType] = useState(exercise.weightType ?? "weighted");
  const [trackingType, setTrackingType] = useState(exercise.trackingType ?? "reps");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showImage, setShowImage] = useState(false);

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

  // Inline helper to render a settings badge with label above + optional tooltip
  const renderBadge = (label: string, value: string | number, onChange: (v: string) => void, onFieldBlur: () => void, field: string, opts?: { type?: string; inputWidth?: string; min?: number; placeholder?: string; tip?: string }) => {
    const { type, inputWidth = "w-8", min, placeholder, tip } = opts || {};
    return (
      <div className="flex flex-col items-center gap-0" key={field}>
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[9px] text-muted-foreground/60 leading-tight flex items-center gap-0.5 cursor-help">
                {label}
                <Info className="w-2 h-2" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">{tip}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-[9px] text-muted-foreground/60 leading-tight">{label}</span>
        )}
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
      <td className="py-1.5 px-2 border border-border border-r-0 rounded-l-[5px] sticky left-0 z-10 bg-background">
        {/* Line 1: Exercise name */}
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`flex-1 min-w-0 text-[15px] font-semibold truncate max-w-[180px] md:max-w-none ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}`}
                  data-testid={`text-exercise-name-${exercise.id}`}
                >
                  {name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="md:hidden text-xs font-semibold">{name}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Settings badges — 1 row on desktop, 2 rows on mobile */}
        <div className="hidden md:flex gap-2 items-center mt-2">
          {renderBadge("sets", sets, setSets, () => handleBlur("sets", sets), "sets", { inputWidth: "w-10", placeholder: "3", tip: "Set range, bijv. 2 of 3-4" })}
          {renderBadge(trackingType === "time" ? "time(s)" : "reps", goalReps, setGoalReps, () => handleBlur("goalReps", goalReps), "reps", { inputWidth: "w-12", placeholder: trackingType === "time" ? "30" : "10", tip: trackingType === "time" ? "Seconden, bijv. 30 of 30-45" : "Rep range, bijv. 10 of 10-15" })}
          {renderBadge("tempo", tempo, setTempo, () => handleBlur("tempo", tempo), "tempo", { inputWidth: "w-10", placeholder: "—", tip: "Elk getal = seconden. Bijv. 3010: 3s zakken, 0s pauze onder, 1s omhoog, 0s rust boven" })}
          {renderBadge("rest", rest, setRest, () => handleBlur("rest", rest), "rest", { inputWidth: "w-10", placeholder: "60", tip: "Seconden rust tussen de sets" })}
          {renderBadge("rir", rir, setRir, () => handleBlur("rir", rir), "rir", { inputWidth: "w-8", placeholder: "—", tip: "Reps In Reserve range, bijv. 2 of 0-1" })}
        </div>
        <div className="md:hidden mt-2 space-y-1">
          <div className="flex gap-2 items-center">
            {renderBadge("sets", sets, setSets, () => handleBlur("sets", sets), "sets", { inputWidth: "w-10", placeholder: "3", tip: "Set range, bijv. 2 of 3-4" })}
            {renderBadge(trackingType === "time" ? "time(s)" : "reps", goalReps, setGoalReps, () => handleBlur("goalReps", goalReps), "reps", { inputWidth: "w-12", placeholder: trackingType === "time" ? "30" : "10", tip: trackingType === "time" ? "Seconden, bijv. 30 of 30-45" : "Rep range, bijv. 10 of 10-15" })}
            {renderBadge("tempo", tempo, setTempo, () => handleBlur("tempo", tempo), "tempo", { inputWidth: "w-10", placeholder: "—", tip: "Elk getal = seconden. Bijv. 3010: 3s zakken, 0s pauze onder, 1s omhoog, 0s rust boven" })}
          </div>
          <div className="flex gap-2 items-center">
            {renderBadge("rest", rest, setRest, () => handleBlur("rest", rest), "rest", { inputWidth: "w-10", placeholder: "60", tip: "Seconden rust tussen de sets" })}
            {renderBadge("rir", rir, setRir, () => handleBlur("rir", rir), "rir", { inputWidth: "w-8", placeholder: "—", tip: "Reps In Reserve range, bijv. 2 of 0-1" })}
          </div>
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
                  <p className="text-xs text-muted-foreground italic cursor-default leading-tight max-w-[150px] md:max-w-[260px] line-clamp-2 md:line-clamp-1">
                    {notes}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">{notes}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : hasNotes ? (
          <div className="flex items-start gap-1 mt-2">
            <MessageCircleWarning className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground italic cursor-default leading-tight max-w-[150px] md:max-w-[260px] line-clamp-2 md:line-clamp-1">{notes}</p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs whitespace-pre-wrap">{notes}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </td>

      {/* Weight columns */}
      {weeks.map((weekNum, idx) => {
        const isLastWeek = idx === weeks.length - 1;
        const weekLocked = lockedWeeks?.has(weekNum) ?? false;
        const cellReadOnly = readOnly || weekLocked;
        const needsRightBorder = isLastWeek && readOnly;
        return (
        <td
          key={weekNum}
          className={`py-1 px-1 min-w-[100px] w-[110px] max-w-[110px] transition-colors border-y border-border whitespace-nowrap ${needsRightBorder ? "border-r border-border rounded-r-[5px]" : ""} ${hoveredWeek === weekNum ? "bg-primary/10" : ""}`}
          onMouseEnter={() => onWeekHover(weekNum)}
          onMouseLeave={() => onWeekHover(null)}
        >
          <div className="flex flex-col items-center gap-0.5">
            {Array.from({ length: Math.max(...String(sets).split(/[-–]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n)), 3) }, (_, i) => i + 1).map((setNum) => {
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
                  initialSkipped={log?.skipped ?? 0}
                  initialNotes={log?.notes ?? ""}
                  monthId={monthId}
                  onBeforeChange={onBeforeChange}
                  readOnly={cellReadOnly}
                  previousWeight={prevLog?.weight}
                  previousReps={prevLog?.reps}
                  weightType={weightType}
                  trackingType={trackingType}
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
          {/* Image icon — under chart icon */}
          <button
            onClick={() => setShowImage(true)}
            className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex items-center justify-center w-full ${exercise.imageUrl ? "text-muted-foreground/40 hover:text-primary" : "text-muted-foreground/20 hover:text-muted-foreground"}`}
            data-testid={`button-image-${exercise.id}`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
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
              <div className="space-y-3 py-2">
                <div className={`flex items-center gap-2 ${trackingType === "time" ? "opacity-40 pointer-events-none" : ""}`}>
                  <Switch
                    id={`weight-toggle-${exercise.id}`}
                    checked={weightType === "weighted"}
                    disabled={trackingType === "time"}
                    onCheckedChange={(checked) => {
                      const newType = checked ? "weighted" : "reps_only";
                      setWeightType(newType);
                      onBeforeChange();
                      updateExercise.mutate({ weightType: newType });
                    }}
                    data-testid={`toggle-weight-type-${exercise.id}`}
                  />
                  <Label htmlFor={`weight-toggle-${exercise.id}`} className="text-sm cursor-pointer">
                    Gewichten
                  </Label>
                </div>
                <div className={`flex items-center gap-2 ${weightType === "weighted" || trackingType === "time" ? "opacity-40 pointer-events-none" : ""}`}>
                  <Switch
                    id={`bodyweight-toggle-${exercise.id}`}
                    checked={weightType === "bodyweight"}
                    disabled={weightType === "weighted" || trackingType === "time"}
                    onCheckedChange={(checked) => {
                      const newType = checked ? "bodyweight" : "reps_only";
                      setWeightType(newType);
                      onBeforeChange();
                      updateExercise.mutate({ weightType: newType });
                    }}
                    data-testid={`toggle-bodyweight-${exercise.id}`}
                  />
                  <Label htmlFor={`bodyweight-toggle-${exercise.id}`} className="text-sm cursor-pointer">
                    Bodyweight
                  </Label>
                </div>
                {weightType === "bodyweight" && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Charts gebruiken het lichaamsgewicht uit de laatste Body Composition meting.
                  </p>
                )}
                <div className="border-t border-border pt-3">
                  <div className={`flex items-center gap-2 ${weightType !== "reps_only" ? "opacity-40 pointer-events-none" : ""}`}>
                    <Switch
                      id={`time-toggle-${exercise.id}`}
                      checked={trackingType === "time"}
                      disabled={weightType !== "reps_only"}
                      onCheckedChange={(checked) => {
                        const newType = checked ? "time" : "reps";
                        setTrackingType(newType);
                        onBeforeChange();
                        updateExercise.mutate({ trackingType: newType });
                      }}
                      data-testid={`toggle-tracking-type-${exercise.id}`}
                    />
                    <Label htmlFor={`time-toggle-${exercise.id}`} className="text-sm cursor-pointer">
                      Tijd (seconden)
                    </Label>
                  </div>
                  {trackingType === "time" && (
                    <p className="text-[10px] text-muted-foreground leading-snug mt-1">
                      Invoer in seconden in plaats van reps.
                    </p>
                  )}
                </div>
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
        {/* Exercise image dialog with picker */}
        <ExerciseImageDialog
          open={showImage}
          onOpenChange={setShowImage}
          exercise={exercise}
          monthId={monthId}
          readOnly={readOnly}
        />
      </td>
    </tr>
  );
}

// --- Exercise Image Dialog with search/upload tabs ---
function ExerciseImageDialog({ open, onOpenChange, exercise, monthId, readOnly }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise;
  monthId: number;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "search" | "upload">("view");
  const [searchQuery, setSearchQuery] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const activeQuery = searchQuery.trim() || exercise.name;

  const { data: results = [], isFetching } = useQuery<{ name: string; gifUrl: string; bodyPart?: string; target?: string; equipment?: string }[]>({
    queryKey: ["/api/exercise-images/search", activeQuery],
    queryFn: () => apiRequest("GET", `/api/exercise-images/search?q=${encodeURIComponent(activeQuery)}`).then(r => r.json()),
    enabled: open && mode === "search",
    staleTime: 60000,
  });

  const selectImage = useMutation({
    mutationFn: (gifUrl: string) => apiRequest("POST", "/api/exercise-images/select", { exerciseId: exercise.id, gifUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setMode("view");
      setSelecting(null);
    },
  });

  const handleSelect = (gifUrl: string) => {
    setSelecting(gifUrl);
    selectImage.mutate(gifUrl);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("exerciseId", String(exercise.id));

      const token = (await import("@/lib/auth-token")).getAuthToken();
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/exercise-images/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload mislukt");
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setMode("view");
      setUploadPreview(null);
    } catch (e: any) {
      console.error("Upload error:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) { setMode("view"); setSearchQuery(""); setUploadPreview(null); setUploadFile(null); }
  };

  const isEditing = mode === "search" || mode === "upload";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[500px] p-4 max-h-[85vh] overflow-y-auto"
        onPaste={(e) => {
          if (mode !== "upload" || uploadPreview) return;
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) {
                setUploadFile(file);
                setUploadPreview(URL.createObjectURL(file));
              }
              break;
            }
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">{exercise.name}</DialogTitle>
        </DialogHeader>

        {/* View mode: show current image */}
        {mode === "view" && (
          <>
            {exercise.imageUrl ? (
              <div className="flex justify-center">
                <img src={exercise.imageUrl} alt={exercise.name} className="rounded-md max-h-[300px] object-contain" loading="lazy" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Geen afbeelding gekoppeld.</p>
            )}
            {!readOnly && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setMode("upload")}>
                  <Search className="w-3 h-3" />
                  {exercise.imageUrl ? "Wijzigen" : "Afbeelding toevoegen"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Edit mode: tabs */}
        {isEditing && !readOnly && (
          <>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                  mode === "upload" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("upload")}
              >
                <Upload className="w-3 h-3" /> Upload eigen afbeelding
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                  mode === "search" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMode("search")}
              >
                <Search className="w-3 h-3" /> Zoeken
              </button>
            </div>

            {/* Search tab */}
            {mode === "search" && (
              <div className="space-y-3">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={exercise.name}
                  className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  data-testid="input-image-search"
                />

                {isFetching && <p className="text-xs text-muted-foreground text-center">Zoeken...</p>}
                {!isFetching && results.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Geen resultaten gevonden.</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(r.gifUrl)}
                      disabled={!!selecting}
                      className={`relative border rounded-md overflow-hidden hover:border-primary transition-colors ${
                        selecting === r.gifUrl ? "border-primary ring-2 ring-primary/30" : "border-border"
                      }`}
                      data-testid={`button-select-image-${i}`}
                    >
                      <img src={r.gifUrl} alt={r.name} className="w-full h-[120px] object-contain bg-white" loading="lazy" />
                      <div className="px-1.5 py-1 bg-card">
                        <p className="text-[10px] font-medium truncate">{r.name}</p>
                        {r.target && <p className="text-[9px] text-muted-foreground truncate">{r.target}{r.equipment ? ` · ${r.equipment}` : ""}</p>}
                      </div>
                      {selecting === r.gifUrl && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upload tab */}
            {mode === "upload" && (
              <div className="space-y-3">
                {uploadPreview ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img src={uploadPreview} alt="Preview" className="rounded-md max-h-[200px] object-contain" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setUploadPreview(null); setUploadFile(null); }}>
                        Annuleren
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs"
                        disabled={uploading}
                        onClick={() => {
                          if (uploadFile) handleUpload(uploadFile);
                        }}
                      >
                        {uploading ? "Uploaden..." : "Opslaan"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md p-8 cursor-pointer hover:border-primary/50 transition-colors focus-within:border-primary/50"
                    htmlFor="exercise-image-upload"
                    tabIndex={0}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                          const file = item.getAsFile();
                          if (file) {
                            setUploadFile(file);
                            setUploadPreview(URL.createObjectURL(file));
                          }
                          break;
                        }
                      }
                    }}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Klik om te kiezen of plak een afbeelding</span>
                    <span className="text-[10px] text-muted-foreground/60">GIF, JPG, PNG of WebP (max 10MB)</span>
                  </label>
                )}
                <input
                  id="exercise-image-upload"
                  type="file"
                  accept=".gif,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                      setUploadPreview(URL.createObjectURL(file));
                    }
                  }}
                  data-testid="input-image-upload"
                />
              </div>
            )}

            {/* Back button */}
            <div className="flex justify-start pt-1">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setMode("view"); setUploadPreview(null); setUploadFile(null); }}>
                Terug
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
