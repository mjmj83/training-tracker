import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { ChevronLeft, ChevronRight, MessageCircleWarning, X, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

/** A single step in the training sequence */
interface TrainStep {
  exercise: Exercise & { weightLogs: WeightLog[] };
  setNumber: number;
  groupLabel: string; // "" or "Superset", "Triset", etc.
  groupExerciseIndex: number; // 0-based within group
  groupExerciseCount: number; // total exercises in group
  totalSetsInGroup: number; // sets per exercise in this group
  currentSetInGroup: number; // which set round (1-based)
}

function parseMaxRange(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const s = String(val);
  const parts = s.split("-").map(Number);
  return Math.max(...parts.filter(n => !isNaN(n)), 0);
}

/** Build the flat sequence of steps for a training day */
function buildSteps(exercises: (Exercise & { weightLogs: WeightLog[] })[]): TrainStep[] {
  const sorted = [...exercises].sort((a, b) => a.sortOrder - b.sortOrder);

  // Group by superset
  const groups: { groupId: number | null; exercises: typeof sorted }[] = [];
  for (const ex of sorted) {
    const gid = ex.supersetGroupId;
    if (gid !== null) {
      const existing = groups.find(g => g.groupId === gid);
      if (existing) existing.exercises.push(ex);
      else groups.push({ groupId: gid, exercises: [ex] });
    } else {
      groups.push({ groupId: null, exercises: [ex] });
    }
  }

  const steps: TrainStep[] = [];
  for (const group of groups) {
    const exs = group.exercises;
    const isGrouped = group.groupId !== null && exs.length > 1;
    const groupLabel = isGrouped
      ? exs.length === 2 ? "Superset" : exs.length === 3 ? "Triset" : "Giant set"
      : "";
    // Use max sets across all exercises in the group
    const maxSets = Math.max(...exs.map(e => parseMaxRange(e.sets) || 3));

    if (isGrouped) {
      // Rotate: set1 of all exercises, then set2 of all, etc.
      for (let s = 1; s <= maxSets; s++) {
        for (let ei = 0; ei < exs.length; ei++) {
          steps.push({
            exercise: exs[ei],
            setNumber: s,
            groupLabel,
            groupExerciseIndex: ei,
            groupExerciseCount: exs.length,
            totalSetsInGroup: maxSets,
            currentSetInGroup: s,
          });
        }
      }
    } else {
      const ex = exs[0];
      const numSets = parseMaxRange(ex.sets) || 3;
      for (let s = 1; s <= numSets; s++) {
        steps.push({
          exercise: ex,
          setNumber: s,
          groupLabel: "",
          groupExerciseIndex: 0,
          groupExerciseCount: 1,
          totalSetsInGroup: numSets,
          currentSetInGroup: s,
        });
      }
    }
  }
  return steps;
}

export default function TrainNowPage() {
  const [, params] = useRoute("/train/:monthId/:dayId");
  const monthId = params?.monthId ? parseInt(params.monthId) : null;
  const dayId = params?.dayId ? parseInt(params.dayId) : null;

  const { data: fullData } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then(r => r.json()),
    enabled: !!monthId,
  });

  const day = fullData?.trainingDays.find(d => d.id === dayId);
  const weekCount = fullData?.month?.weekCount ?? 4;

  // Auto-select first week without data
  const autoWeek = useMemo(() => {
    if (!day) return 1;
    for (let w = 1; w <= weekCount; w++) {
      const hasData = day.exercises.some(ex =>
        ex.weightLogs.some(l => l.weekNumber === w && (l.weight != null || l.reps != null))
      );
      if (!hasData) return w;
    }
    return weekCount; // all full, use last
  }, [day, weekCount]);

  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  useEffect(() => { if (autoWeek && weekNumber === null) setWeekNumber(autoWeek); }, [autoWeek]);

  const steps = useMemo(() => day ? buildSteps(day.exercises) : [], [day]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [finished, setFinished] = useState(false);

  // Local state for the current step's values
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [skipped, setSkipped] = useState(false);

  // Track saved data locally for summary
  const [savedData, setSavedData] = useState<Record<string, { weight: string; reps: string; skipped: boolean; notes: string }>>({});

  const step = steps[currentStep];
  const wk = weekNumber ?? 1;

  // Load existing data when step changes
  useEffect(() => {
    if (!step) return;
    const key = `${step.exercise.id}-${wk}-${step.setNumber}`;
    const saved = savedData[key];
    if (saved) {
      setWeight(saved.weight);
      setReps(saved.reps);
      setSkipped(saved.skipped);
      setNotes(saved.notes);
    } else {
      const log = step.exercise.weightLogs.find(
        l => l.weekNumber === wk && l.setNumber === step.setNumber
      );
      setWeight(log?.weight != null ? String(log.weight) : "");
      setReps(log?.reps != null ? String(log.reps) : "");
      setSkipped(!!log?.skipped);
      setNotes(log?.notes ?? "");
    }
    setShowNotes(false);
  }, [currentStep, step, wk]);

  const upsertLog = useMutation({
    mutationFn: (data: { exerciseId: number; weekNumber: number; setNumber: number; weight: number | null; reps: number | null; skipped: number; notes: string }) =>
      apiRequest("POST", "/api/weight-logs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const toggleLock = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/week-dates/toggle-lock", {
        monthId, trainingDayId: dayId, weekNumber: wk, locked: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const saveCurrentStep = useCallback(() => {
    if (!step) return;
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps) : null;
    const key = `${step.exercise.id}-${wk}-${step.setNumber}`;
    setSavedData(prev => ({ ...prev, [key]: { weight, reps, skipped, notes } }));
    upsertLog.mutate({
      exerciseId: step.exercise.id,
      weekNumber: wk,
      setNumber: step.setNumber,
      weight: w,
      reps: r,
      skipped: skipped ? 1 : 0,
      notes,
    });
  }, [step, weight, reps, skipped, notes, wk]);

  const goNext = () => {
    saveCurrentStep();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setFinished(true);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      saveCurrentStep();
      setCurrentStep(currentStep - 1);
    }
  };

  // Loading / error states
  if (!monthId || !dayId) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Ongeldige link</div>;
  }
  if (!fullData) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-pulse text-muted-foreground text-sm">Laden...</div></div>;
  }
  if (!day || steps.length === 0) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Geen oefeningen gevonden</div>;
  }

  const isWeighted = step?.exercise.weightType === "weighted";
  const isTimeBased = step?.exercise.trackingType === "time";
  const repsLabel = isTimeBased ? "Seconden" : "Reps";

  // Previous week data for reference
  const prevWeekLog = step ? step.exercise.weightLogs.find(
    l => l.weekNumber === wk - 1 && l.setNumber === step.setNumber
  ) : null;

  // Finished screen
  if (finished) {
    return (
      <div className="flex flex-col h-[100dvh] bg-background text-foreground p-4">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Training afgerond</h1>
          <p className="text-sm text-muted-foreground text-center">
            {day.name} — Week {wk}
          </p>

          {/* Summary */}
          <div className="w-full max-w-sm space-y-1 mt-2">
            {steps.map((s, i) => {
              const key = `${s.exercise.id}-${wk}-${s.setNumber}`;
              const d = savedData[key];
              const log = s.exercise.weightLogs.find(l => l.weekNumber === wk && l.setNumber === s.setNumber);
              const w2 = d?.weight || (log?.weight != null ? String(log.weight) : "");
              const r2 = d?.reps || (log?.reps != null ? String(log.reps) : "");
              const sk = d?.skipped || !!log?.skipped;
              const isW = s.exercise.weightType === "weighted";
              const val = sk ? "skip" : isW && w2 && r2 ? `${w2} x ${r2}` : r2 || "—";
              // Only show exercise name when it changes
              const prevStep = i > 0 ? steps[i - 1] : null;
              const showName = !prevStep || prevStep.exercise.id !== s.exercise.id;
              return (
                <div key={i}>
                  {showName && (
                    <p className="text-xs font-medium mt-2 text-muted-foreground">{s.exercise.name}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground/60 text-xs w-8">S{s.setNumber}</span>
                    <span className={`font-mono tabular-nums ${sk ? "line-through text-muted-foreground/40" : ""}`}>{val}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 space-y-2 pb-safe">
          <Button
            className="w-full h-12 text-base gap-2"
            onClick={() => { toggleLock.mutate(); }}
          >
            <Lock className="w-4 h-4" />
            Week {wk} vergrendelen
          </Button>
          <Button
            variant="ghost"
            className="w-full h-10 text-sm"
            onClick={() => window.close()}
          >
            Sluiten
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      {/* Header — progress */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full mb-3">
          <div
            className="h-1 bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Week {wk}</span>
          <span>{currentStep + 1} / {steps.length}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-4 min-h-0">
        {/* Exercise name + group label */}
        <div className="shrink-0">
          {step.groupLabel && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">{step.groupLabel}</span>
              <span className="text-[10px] text-muted-foreground">
                Oefening {step.groupExerciseIndex + 1}/{step.groupExerciseCount} · Set {step.currentSetInGroup}/{step.totalSetsInGroup}
              </span>
            </div>
          )}
          <h1 className="text-lg font-semibold leading-tight">{step.exercise.name}</h1>

          {/* Settings badges */}
          <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
            <span><span className="text-muted-foreground/50">sets</span> {step.exercise.sets}</span>
            <span><span className="text-muted-foreground/50">{isTimeBased ? "time" : "reps"}</span> {step.exercise.goalReps}{isTimeBased ? "s" : ""}</span>
            {step.exercise.tempo && <span><span className="text-muted-foreground/50">tempo</span> {step.exercise.tempo}</span>}
            {step.exercise.rest && <span><span className="text-muted-foreground/50">rest</span> {step.exercise.rest}s</span>}
            {step.exercise.rir && <span><span className="text-muted-foreground/50">rir</span> {step.exercise.rir}</span>}
          </div>

          {/* Previous week reference */}
          {prevWeekLog && (prevWeekLog.weight != null || prevWeekLog.reps != null) && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Vorige week: {prevWeekLog.weight != null ? `${prevWeekLog.weight} x ` : ""}{prevWeekLog.reps ?? "—"}
            </p>
          )}

          {/* Set indicator for non-grouped */}
          {!step.groupLabel && (
            <p className="text-xs text-muted-foreground mt-1">
              Set {step.setNumber} / {step.totalSetsInGroup}
            </p>
          )}
        </div>

        {/* Input area */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          {skipped ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm italic">Set overgeslagen</p>
              <Button variant="outline" size="sm" onClick={() => setSkipped(false)}>
                Toch invullen
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3">
                {isWeighted && (
                  <>
                    <div className="flex flex-col items-center">
                      <label className="text-[10px] text-muted-foreground mb-1">kg</label>
                      <input
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className="w-24 h-14 text-center text-2xl font-mono tabular-nums bg-muted/60 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary"
                        data-testid="input-train-weight"
                      />
                    </div>
                    <span className="text-muted-foreground text-xl mt-4">×</span>
                  </>
                )}
                <div className="flex flex-col items-center">
                  <label className="text-[10px] text-muted-foreground mb-1">{repsLabel.toLowerCase()}</label>
                  <input
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className={`h-14 text-center text-2xl font-mono tabular-nums bg-muted/60 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary ${isWeighted ? "w-20" : "w-28"}`}
                    data-testid="input-train-reps"
                  />
                </div>
              </div>

              {/* Notes area */}
              {showNotes ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opmerking..."
                  className="text-sm min-h-[60px] max-h-[80px]"
                  autoFocus
                  data-testid="textarea-train-notes"
                />
              ) : (
                <button
                  onClick={() => setShowNotes(true)}
                  className={`flex items-center justify-center gap-1.5 text-xs py-2 rounded transition-colors ${notes ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
                  data-testid="button-train-notes"
                >
                  <MessageCircleWarning className="w-3.5 h-3.5" />
                  {notes ? "Opmerking bewerken" : "Opmerking toevoegen"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer — navigation */}
      <div className="shrink-0 px-4 pb-4 pt-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 shrink-0"
          disabled={currentStep === 0}
          onClick={goPrev}
          data-testid="button-train-prev"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {!skipped && (
          <Button
            variant="ghost"
            size="sm"
            className="h-12 px-3 text-xs text-muted-foreground shrink-0"
            onClick={() => setSkipped(true)}
            data-testid="button-train-skip"
          >
            <X className="w-4 h-4" />
            Skip
          </Button>
        )}

        <Button
          className="flex-1 h-12 text-base"
          onClick={goNext}
          data-testid="button-train-next"
        >
          {currentStep === steps.length - 1 ? "Afronden" : "Volgende"}
          {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
