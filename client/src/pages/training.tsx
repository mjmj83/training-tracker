import { useSelectedClient, useSelectedMonth, getViewMode, saveViewMode } from "@/lib/state";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dumbbell, Undo2, Redo2, Save, Plus, X, Download, List, LayoutGrid, ClipboardList } from "lucide-react";
import OverviewDialog from "@/components/overview-dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import ThemePicker from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TrainingDaySection from "@/components/training-day-section";
import AddTrainingDay from "@/components/add-training-day";
import WeekCountSelector from "@/components/week-count-selector";
import MonthSwitcher from "@/components/month-switcher";
import { useUndoRedo } from "@/lib/undo-redo";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month, Client, AbcMeasurement } from "@shared/schema";
import { useEffect, useCallback, useState, useRef } from "react";
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
  const [viewMode, setViewMode] = useState<"list" | "tabs">(getViewMode);
  const [activeTabDay, setActiveTabDay] = useState<number | null>(null);
  const [showOverview, setShowOverview] = useState(false);

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

  // Auto-select latest month (by startDate) on mount and when client changes
  const autoSelectDoneRef = useRef(false);
  const prevClientRef = useRef(clientId);
  const { data: autoMonths = [] } = useQueryAuto<any[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then(r => r.json()),
    enabled: !!clientId,
  });

  // Reset auto-select when client changes
  if (prevClientRef.current !== clientId) {
    prevClientRef.current = clientId;
    autoSelectDoneRef.current = false;
  }

  useEffect(() => {
    if (clientId && autoMonths.length > 0 && !autoSelectDoneRef.current) {
      const sorted = [...autoMonths].sort((a: any, b: any) => {
        const da = a.startDate || "";
        const db = b.startDate || "";
        return db.localeCompare(da);
      });
      const latest = sorted[0];
      if (latest) {
        setMonthId(latest.id);
      }
      autoSelectDoneRef.current = true;
    }
  }, [clientId, autoMonths]);

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
                Let op! Laatste Body Composition meting was {formatDutchDate(lastAbcDate)}, dit is {daysSinceLastAbc} dagen geleden.{" "}
                <Link href="/abc" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
                  Klik hier om een meting te doen.
                </Link>
              </>
            ) : (
              <>
                Er is nog geen Body Composition meting gedaan.{" "}
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
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <MonthSwitcher readOnly={!isTrainer} />
        <button
          onClick={() => setShowOverview(true)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Overzicht"
          data-testid="button-overview"
        >
          <ClipboardList className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        {/* View mode toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewMode(v => { const next = v === "list" ? "tabs" : "list"; saveViewMode(next); return next; })}
          className="h-7 px-2 text-xs gap-1"
          title={viewMode === "list" ? "Tabweergave" : "Lijstweergave"}
          data-testid="button-view-mode"
        >
          {viewMode === "list" ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
        </Button>
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
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  const res = await apiRequest("GET", `/api/clients/${clientId}/export`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const disposition = res.headers.get("content-disposition");
                  const match = disposition?.match(/filename="(.+)"/);
                  a.download = match?.[1] || "Training Export.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast({ title: "Fout", description: "Export mislukt", variant: "destructive" });
                }
              }}
              className="h-7 px-2 text-xs gap-1"
              data-testid="button-export"
              title="Exporteer alle trainingsblokken naar Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        )}
        {!isTrainer && <div className="flex-1" />}
        <ThemePicker />
      </div>

      {(() => {
        const sortedDays = trainingDays.sort((a, b) => a.sortOrder - b.sortOrder);
        const activeDayId = activeTabDay && sortedDays.find(d => d.id === activeTabDay) ? activeTabDay : sortedDays[0]?.id ?? null;

        const renderDay = (day: typeof sortedDays[0], idx: number, hideHeader = false) => (
          <TrainingDaySection
            key={day.id}
            day={day}
            exercises={day.exercises}
            weekDates={weekDates.filter((wd) => wd.trainingDayId === day.id)}
            monthId={monthId}
            weekCount={weekCount}
            onBeforeChange={pushSnapshot}
            readOnly={!isTrainer}
            hideHeader={hideHeader}
            canMoveDayUp={idx > 0}
            canMoveDayDown={idx < sortedDays.length - 1}
            onMoveDayUp={async () => {
              if (idx <= 0) return;
              pushSnapshot();
              const prev = sortedDays[idx - 1];
              await apiRequest("PATCH", `/api/training-days/${day.id}`, { sortOrder: prev.sortOrder });
              await apiRequest("PATCH", `/api/training-days/${prev.id}`, { sortOrder: day.sortOrder });
              queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
            }}
            onMoveDayDown={async () => {
              if (idx >= sortedDays.length - 1) return;
              pushSnapshot();
              const next = sortedDays[idx + 1];
              await apiRequest("PATCH", `/api/training-days/${day.id}`, { sortOrder: next.sortOrder });
              await apiRequest("PATCH", `/api/training-days/${next.id}`, { sortOrder: day.sortOrder });
              queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
            }}
          />
        );

        if (viewMode === "tabs" && sortedDays.length > 0) {
          return (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-0.5 mb-2 overflow-x-auto">
                {sortedDays.map(day => (
                  <button
                    key={day.id}
                    onClick={() => setActiveTabDay(day.id)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                      activeDayId === day.id
                        ? "bg-primary/10 text-foreground font-medium border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`tab-day-${day.id}`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
              {/* Active day */}
              {sortedDays.map((day, idx) =>
                day.id === activeDayId ? renderDay(day, idx, true) : null
              )}
              {isTrainer && (
                <AddTrainingDay monthId={monthId} sortOrder={trainingDays.length} onBeforeChange={pushSnapshot} />
              )}
            </>
          );
        }

        return (
          <>
            {sortedDays.map((day, idx) => renderDay(day, idx))}
            {isTrainer && (
              <AddTrainingDay monthId={monthId} sortOrder={trainingDays.length} onBeforeChange={pushSnapshot} />
            )}
          </>
        );
      })()}

      <OverviewDialog open={showOverview} onOpenChange={setShowOverview} monthId={monthId} />
    </div>
  );
}
