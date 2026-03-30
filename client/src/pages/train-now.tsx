import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { ChevronLeft, ChevronRight, MessageCircleWarning, X, Check, Lock, Play, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ScrollPicker from "@/components/scroll-picker";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

interface TrainStep {
  exercise: Exercise & { weightLogs: WeightLog[] };
  setNumber: number;
  groupLabel: string; // e.g. "Superset A", "Triset B"
  groupExerciseIndex: number;
  groupExerciseCount: number;
  totalSetsInGroup: number;
  currentSetInGroup: number;
}

function parseMaxRange(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const s = String(val);
  const parts = s.split("-").map(Number);
  return Math.max(...parts.filter(n => !isNaN(n)), 0);
}

function buildSteps(exercises: (Exercise & { weightLogs: WeightLog[] })[]): TrainStep[] {
  const sorted = [...exercises].sort((a, b) => a.sortOrder - b.sortOrder);
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
  let groupLetterIdx = 0; // A, B, C...
  for (const group of groups) {
    const exs = group.exercises;
    const isGrouped = group.groupId !== null && exs.length > 1;
    const letter = String.fromCharCode(65 + groupLetterIdx); // A, B, C...
    const groupLabel = isGrouped
      ? (exs.length === 2 ? "Superset" : exs.length === 3 ? "Triset" : "Giant set") + " " + letter
      : "";
    if (isGrouped) groupLetterIdx++;
    const maxSets = Math.max(...exs.map(e => parseMaxRange(e.sets) || 3));

    if (isGrouped) {
      for (let s = 1; s <= maxSets; s++) {
        for (let ei = 0; ei < exs.length; ei++) {
          steps.push({ exercise: exs[ei], setNumber: s, groupLabel, groupExerciseIndex: ei, groupExerciseCount: exs.length, totalSetsInGroup: maxSets, currentSetInGroup: s });
        }
      }
    } else {
      const ex = exs[0];
      const numSets = parseMaxRange(ex.sets) || 3;
      for (let s = 1; s <= numSets; s++) {
        steps.push({ exercise: ex, setNumber: s, groupLabel: "", groupExerciseIndex: 0, groupExerciseCount: 1, totalSetsInGroup: numSets, currentSetInGroup: s });
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
  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  // Find first week that is not fully completed (not all exercises have data)
  const suggestedWeek = useMemo(() => {
    if (!day || day.exercises.length === 0) return 1;
    for (let w = 1; w <= weekCount; w++) {
      const allExercisesHaveData = day.exercises.every(ex =>
        ex.weightLogs.some(l => l.weekNumber === w && (l.weight != null || l.reps != null))
      );
      if (!allExercisesHaveData) return w;
    }
    return weekCount;
  }, [day, weekCount]);

  // State machine: "pick-week" -> "training" -> "finished"
  const [phase, setPhase] = useState<"pick-week" | "training" | "finished">("pick-week");
  const [weekNumber, setWeekNumber] = useState<number>(1);
  useEffect(() => { if (suggestedWeek) setWeekNumber(suggestedWeek); }, [suggestedWeek]);

  const steps = useMemo(() => day ? buildSteps(day.exercises) : [], [day]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [savedData, setSavedData] = useState<Record<string, { weight: string; reps: string; skipped: boolean; notes: string }>>({});

  const step = steps[currentStep];
  const wk = weekNumber;

  // Load existing data when step changes, with fallback to previous set
  useEffect(() => {
    if (!step || phase !== "training") return;
    const key = `${step.exercise.id}-${wk}-${step.setNumber}`;
    const saved = savedData[key];
    if (saved) {
      setWeight(saved.weight);
      setReps(saved.reps);
      setSkipped(saved.skipped);
      setNotes(saved.notes);
    } else {
      const log = step.exercise.weightLogs.find(l => l.weekNumber === wk && l.setNumber === step.setNumber);
      if (log && (log.weight != null || log.reps != null)) {
        // Existing data for this set
        setWeight(log.weight != null ? String(log.weight) : "");
        setReps(log.reps != null ? String(log.reps) : "");
        setSkipped(!!log.skipped);
        setNotes(log.notes ?? "");
      } else {
        // Fallback: previous set of same exercise in same week (from savedData or logs)
        let fallbackW = "";
        let fallbackR = "";
        if (step.setNumber > 1) {
          const prevKey = `${step.exercise.id}-${wk}-${step.setNumber - 1}`;
          const prevSaved = savedData[prevKey];
          if (prevSaved && (prevSaved.weight || prevSaved.reps)) {
            fallbackW = prevSaved.weight;
            fallbackR = prevSaved.reps;
          } else {
            const prevLog = step.exercise.weightLogs.find(l => l.weekNumber === wk && l.setNumber === step.setNumber - 1);
            if (prevLog) {
              fallbackW = prevLog.weight != null ? String(prevLog.weight) : "";
              fallbackR = prevLog.reps != null ? String(prevLog.reps) : "";
            }
          }
        }
        setWeight(fallbackW);
        setReps(fallbackR);
        setSkipped(false);
        setNotes("");
      }
    }
    setShowNotes(false);
    setShowImage(false);
  }, [currentStep, step, wk, phase]);

  const upsertLog = useMutation({
    mutationFn: (data: { exerciseId: number; weekNumber: number; setNumber: number; weight: number | null; reps: number | null; skipped: number; notes: string }) =>
      apiRequest("POST", "/api/weight-logs", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] }); },
  });

  const toggleLock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/week-dates/toggle-lock", { monthId, trainingDayId: dayId, weekNumber: wk, locked: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] }); },
  });

  const saveCurrentStep = useCallback(() => {
    if (!step) return;
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps) : null;
    const key = `${step.exercise.id}-${wk}-${step.setNumber}`;
    setSavedData(prev => ({ ...prev, [key]: { weight, reps, skipped, notes } }));
    upsertLog.mutate({ exerciseId: step.exercise.id, weekNumber: wk, setNumber: step.setNumber, weight: w, reps: r, skipped: skipped ? 1 : 0, notes });
  }, [step, weight, reps, skipped, notes, wk]);

  const goNext = () => {
    saveCurrentStep();
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else setPhase("finished");
  };

  const goPrev = () => {
    if (currentStep > 0) { saveCurrentStep(); setCurrentStep(currentStep - 1); }
  };

  // Loading states
  if (!monthId || !dayId) return <div className="flex items-center justify-center h-[100dvh] text-muted-foreground text-sm">Ongeldige link</div>;
  if (!fullData) return <div className="flex items-center justify-center h-[100dvh]"><div className="animate-pulse text-muted-foreground text-sm">Laden...</div></div>;
  if (!day || steps.length === 0) return <div className="flex items-center justify-center h-[100dvh] text-muted-foreground text-sm">Geen oefeningen gevonden</div>;

  const isWeighted = step?.exercise.weightType === "weighted";
  const isRepsOnly = step?.exercise.weightType === "reps_only" || step?.exercise.weightType === "bodyweight";
  const isTimeBased = step?.exercise.trackingType === "time";
  const repsLabel = isTimeBased ? "seconden" : "reps";
  const imageUrl = step?.exercise.imageUrl;

  const prevWeekLog = step ? step.exercise.weightLogs.find(l => l.weekNumber === wk - 1 && l.setNumber === step.setNumber) : null;

  // === PHASE: Pick Week ===
  if (phase === "pick-week") {
    return (
      <div className="flex flex-col h-[100dvh] bg-background text-foreground">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Play className="w-7 h-7 text-primary fill-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">{day.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{fullData.month.label}</p>
          </div>

          <div className="w-full max-w-[200px]">
            <label className="text-xs text-muted-foreground block text-center mb-2">Week</label>
            <Select value={String(weekNumber)} onValueChange={(v) => setWeekNumber(parseInt(v))}>
              <SelectTrigger className="h-12 text-lg text-center justify-center font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map(w => {
                  const hasData = day.exercises.some(ex => ex.weightLogs.some(l => l.weekNumber === w && (l.weight != null || l.reps != null)));
                  const isLocked = fullData.weekDates.some(wd => wd.trainingDayId === dayId && wd.weekNumber === w && wd.locked);
                  const wd = fullData.weekDates.find(wd2 => wd2.trainingDayId === dayId && wd2.weekNumber === w);
                  const dateStr = wd?.date ? new Date(wd.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "";
                  return (
                    <SelectItem key={w} value={String(w)}>
                      Week {w}{dateStr ? ` · ${dateStr}` : ""}
                      {isLocked ? " 🔒" : hasData ? " ✓" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {steps.length} sets · {new Set(steps.map(s => s.exercise.id)).size} oefeningen
          </p>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <Button className="w-full h-14 text-lg gap-2" onClick={() => setPhase("training")}>
            <Play className="w-5 h-5 fill-current" />
            Start training
          </Button>
        </div>
      </div>
    );
  }

  // === PHASE: Finished ===
  if (phase === "finished") {
    return (
      <div className="flex flex-col h-[100dvh] bg-background text-foreground p-4">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 overflow-y-auto">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Training afgerond</h1>
          <p className="text-sm text-muted-foreground">{day.name} — Week {wk}</p>

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
              const prevStep = i > 0 ? steps[i - 1] : null;
              const showName = !prevStep || prevStep.exercise.id !== s.exercise.id;
              return (
                <div key={i}>
                  {showName && <p className="text-xs font-medium mt-3 text-muted-foreground">{s.exercise.name}</p>}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground/60 text-xs w-8">S{s.setNumber}</span>
                    <span className={`font-mono tabular-nums ${sk ? "line-through text-muted-foreground/40" : ""}`}>{val}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 space-y-2 pt-2 pb-safe">
          <Button className="w-full h-12 text-base gap-2" onClick={() => toggleLock.mutate()}>
            <Lock className="w-4 h-4" /> Week {wk} vergrendelen
          </Button>
          <Button variant="ghost" className="w-full h-10 text-sm" onClick={() => window.close()}>Sluiten</Button>
        </div>
      </div>
    );
  }

  // === PHASE: Training ===
  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      {/* Progress */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="w-full h-1.5 bg-muted rounded-full mb-2">
          <div className="h-1.5 bg-primary rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Week {wk}</span>
          <span className="tabular-nums">{currentStep + 1} / {steps.length}</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col px-4 min-h-0">
        {/* Exercise info */}
        <div className="shrink-0">
          {step.groupLabel && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-primary font-bold">{step.groupLabel}</span>
              <span className="text-sm text-muted-foreground font-semibold">
                Oefening {step.groupExerciseIndex + 1}/{step.groupExerciseCount} · Set {step.currentSetInGroup}/{step.totalSetsInGroup}
              </span>
            </div>
          )}

          {/* Exercise name — clickable if has image */}
          {imageUrl ? (
            <button onClick={() => setShowImage(true)} className="text-left">
              <h1 className="text-2xl font-bold leading-tight underline decoration-primary/30 underline-offset-2">{step.exercise.name}</h1>
            </button>
          ) : (
            <h1 className="text-2xl font-bold leading-tight">{step.exercise.name}</h1>
          )}

          {/* Settings — label above, value below */}
          <div className="flex gap-4 mt-3">
            {[
              { label: "sets", value: step.exercise.sets },
              { label: isTimeBased ? "time" : "reps", value: `${step.exercise.goalReps}${isTimeBased ? "s" : ""}` },
              ...(step.exercise.tempo ? [{ label: "tempo", value: step.exercise.tempo }] : []),
              ...(step.exercise.rest ? [{ label: "rest", value: `${step.exercise.rest}s` }] : []),
              ...(step.exercise.rir ? [{ label: "rir", value: step.exercise.rir }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                <span className="text-sm font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {/* Previous week reference */}
          {prevWeekLog && (prevWeekLog.weight != null || prevWeekLog.reps != null) && (
            <p className="text-sm text-muted-foreground/60 mt-2">
              Vorige week: {prevWeekLog.weight != null ? `${prevWeekLog.weight} x ` : ""}{prevWeekLog.reps ?? "—"}
            </p>
          )}

          {/* Set indicator for non-grouped */}
          {!step.groupLabel && (
            <p className="text-sm text-muted-foreground mt-2">
              Set {step.setNumber} / {step.totalSetsInGroup}
            </p>
          )}
        </div>

        {/* Input area */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          {skipped ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground text-base italic">Set overgeslagen</p>
              <Button variant="outline" onClick={() => setSkipped(false)}>Toch invullen</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4">
                {isWeighted ? (
                  <>
                    <div className="flex flex-col items-center">
                      <label className="text-xs text-muted-foreground mb-1">kg</label>
                      <input
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        className="w-28 h-16 text-center text-3xl font-mono tabular-nums bg-muted/60 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                        data-testid="input-train-weight"
                      />
                    </div>
                    <span className="text-muted-foreground text-2xl mt-5">×</span>
                    <div className="flex flex-col items-center">
                      <label className="text-xs text-muted-foreground mb-1">{repsLabel}</label>
                      <input
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        inputMode="numeric"
                        placeholder="—"
                        className="w-24 h-16 text-center text-3xl font-mono tabular-nums bg-muted/60 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                        data-testid="input-train-reps"
                      />
                    </div>
                  </>
                ) : isRepsOnly && !isTimeBased ? (
                  <div className="w-28">
                    <label className="text-xs text-muted-foreground text-center block mb-1">{repsLabel}</label>
                    <ScrollPicker
                      value={reps ? parseInt(reps) || 0 : 0}
                      onChange={(v) => setReps(String(v))}
                      min={0}
                      max={100}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <label className="text-xs text-muted-foreground mb-1">{repsLabel}</label>
                    <input
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      inputMode="numeric"
                      placeholder="—"
                      className="w-32 h-16 text-center text-3xl font-mono tabular-nums bg-muted/60 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                      data-testid="input-train-reps"
                    />
                  </div>
                )}
              </div>

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
                  className={`flex items-center justify-center gap-1.5 text-sm py-2 rounded transition-colors ${notes ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
                >
                  <MessageCircleWarning className="w-4 h-4" />
                  {notes ? "Opmerking bewerken" : "Opmerking toevoegen"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-4 pt-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0" disabled={currentStep === 0} onClick={goPrev}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        {!skipped && (
          <Button variant="ghost" size="sm" className="h-12 px-3 text-sm text-muted-foreground shrink-0" onClick={() => setSkipped(true)}>
            <X className="w-4 h-4 mr-1" /> Skip
          </Button>
        )}
        <Button className="flex-1 h-12 text-base" onClick={goNext}>
          {currentStep === steps.length - 1 ? "Afronden" : "Volgende"}
          {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>

      {/* Image popup */}
      {imageUrl && (
        <Dialog open={showImage} onOpenChange={setShowImage}>
          <DialogContent className="sm:max-w-[400px] p-2">
            <img src={imageUrl} alt={step.exercise.name} className="w-full rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
