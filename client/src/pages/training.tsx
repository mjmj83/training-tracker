import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dumbbell, Undo2, Redo2, Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TrainingDaySection from "@/components/training-day-section";
import AddTrainingDay from "@/components/add-training-day";
import WeekCountSelector from "@/components/week-count-selector";
import MonthSwitcher from "@/components/month-switcher";
import { useUndoRedo } from "@/lib/undo-redo";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month, Client, AbcMeasurement } from "@shared/schema";
import { useEffect, useCallback, useState } from "react";
import { useQuery as useQueryAuto } from "@tanstack/react-query";
import { Link } from "wouter";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

export default function TrainingPage() {
  const { clientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();
  const { toast } = useToast();
  const { canUndo, canRedo, undo, redo, pushSnapshot, undoCount, redoCount } = useUndoRedo(monthId);
  const isTrainer = useIsTrainer();
  const [bfBannerDismissed, setBfBannerDismissed] = useState(false);

  // Fetch clients to get bfReminderEnabled for the selected client
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const selectedClient = clients.find(c => c.id === clientId);

  // Fetch ABC measurements for selected client
  const { data: abcMeasurements = [] } = useQuery<AbcMeasurement[]>({
    queryKey: ["/api/clients", clientId, "abc"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/abc`).then(r => r.json()),
    enabled: !!clientId && isTrainer && !!selectedClient?.bfReminderEnabled,
  });

  // Reset dismissed state when client changes
  useEffect(() => {
    setBfBannerDismissed(false);
  }, [clientId]);

  const { data, isLoading } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then((r) => r.json()),
    enabled: !!monthId,
  });

  const saveState = useMutation({
    mutationFn: () => apiRequest("POST", `/api/months/${monthId}/save`),
    onSuccess: () => {
      toast({ title: "Opgeslagen", description: "Huidige staat is opgeslagen." });
    },
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isTrainer) return; // No keyboard shortcuts for clients
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (canUndo) undo();
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      if (canRedo) redo();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (monthId) saveState.mutate();
    }
  }, [canUndo, canRedo, undo, redo, monthId, isTrainer]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-select last month when client is selected
  const { data: autoMonths = [] } = useQueryAuto<any[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then(r => r.json()),
    enabled: !!clientId && !monthId,
  });

  useEffect(() => {
    if (clientId && !monthId && autoMonths.length > 0) {
      const last = autoMonths[autoMonths.length - 1];
      setMonthId(last.id);
    }
  }, [clientId, monthId, autoMonths]);

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant in de zijbalk</p>
      </div>
    );
  }

  if (!monthId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">{isTrainer ? "Maak een nieuw trainingsblok aan" : "Geen trainingsblokken beschikbaar"}</p>
        <div className="flex items-center gap-2">
          <MonthSwitcher readOnly={!isTrainer} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  const month = data?.month;
  const trainingDays = data?.trainingDays ?? [];
  const weekDates = data?.weekDates ?? [];
  const weekCount = month?.weekCount ?? 4;

  // Compute body fat reminder
  const showBfReminder = isTrainer && !!clientId && !!selectedClient?.bfReminderEnabled && !bfBannerDismissed;
  const lastAbcMeasurement = abcMeasurements.length > 0
    ? abcMeasurements.reduce((latest, m) => (m.date > latest.date ? m : latest), abcMeasurements[0])
    : null;
  const lastAbcDate = lastAbcMeasurement ? new Date(lastAbcMeasurement.date) : null;
  const daysSinceLastAbc = lastAbcDate
    ? Math.floor((Date.now() - lastAbcDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const bfReminderNeeded = showBfReminder && (daysSinceLastAbc === null || daysSinceLastAbc > 30);

  const formatDutchDate = (date: Date) => {
    const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="p-4 space-y-2">
      {/* Body fat reminder banner */}
      {bfReminderNeeded && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-md px-4 py-3 flex items-start gap-2 text-sm">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span className="flex-1">
            {lastAbcDate && daysSinceLastAbc !== null ? (
              <>
                Let op! Laatste vetpercentage meting was {formatDutchDate(lastAbcDate)}, dit is {daysSinceLastAbc} dagen geleden.{" "}
                <Link href="/abc" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
                  Klik hier om een meting te doen.
                </Link>
              </>
            ) : (
              <>
                Er is nog geen vetpercentage meting gedaan.{" "}
                <Link href="/abc" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
                  Klik hier om een meting te doen.
                </Link>
              </>
            )}
          </span>
          <button
            onClick={() => setBfBannerDismissed(true)}
            className="shrink-0 p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
            title="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-2">
        <MonthSwitcher readOnly={!isTrainer} />
        <div className="flex-1" />
        {isTrainer && (
          <div className="flex items-center gap-1">
            <WeekCountSelector monthId={monthId} currentCount={weekCount} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { if (canUndo) undo(); }}
              disabled={!canUndo}
              className="h-7 px-2 text-xs gap-1"
              data-testid="button-undo"
              title={`Ongedaan maken (${undoCount})`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Undo</span>
              {undoCount > 0 && <span className="text-muted-foreground">({undoCount})</span>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { if (canRedo) redo(); }}
              disabled={!canRedo}
              className="h-7 px-2 text-xs gap-1"
              data-testid="button-redo"
              title={`Opnieuw (${redoCount})`}
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Redo</span>
              {redoCount > 0 && <span className="text-muted-foreground">({redoCount})</span>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveState.mutate()}
              className="h-7 px-2 text-xs gap-1"
              data-testid="button-save"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Opslaan</span>
            </Button>
          </div>
        )}
      </div>

      {trainingDays
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((day) => (
          <TrainingDaySection
            key={day.id}
            day={day}
            exercises={day.exercises}
            weekDates={weekDates.filter((wd) => wd.trainingDayId === day.id)}
            monthId={monthId}
            weekCount={weekCount}
            onBeforeChange={pushSnapshot}
            readOnly={!isTrainer}
          />
        ))}
      {isTrainer && (
        <AddTrainingDay monthId={monthId} sortOrder={trainingDays.length} onBeforeChange={pushSnapshot} />
      )}
    </div>
  );
}
