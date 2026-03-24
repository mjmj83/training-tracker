import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dumbbell, Undo2, Redo2, Save, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TrainingDaySection from "@/components/training-day-section";
import AddTrainingDay from "@/components/add-training-day";
import WeekCountSelector from "@/components/week-count-selector";
import MonthSwitcher from "@/components/month-switcher";
import { useUndoRedo } from "@/lib/undo-redo";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";
import { useEffect, useCallback } from "react";
import { useQuery as useQueryAuto } from "@tanstack/react-query";

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
  }, [canUndo, canRedo, undo, redo, monthId]);

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
        <p className="text-sm">Maak een nieuw trainingsblok aan</p>
        <div className="flex items-center gap-2">
          <MonthSwitcher />
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

  return (
    <div className="p-4 space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-2">
        <MonthSwitcher />
        <div className="flex-1" />
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
          />
        ))}
      <AddTrainingDay monthId={monthId} sortOrder={trainingDays.length} onBeforeChange={pushSnapshot} />
    </div>
  );
}
