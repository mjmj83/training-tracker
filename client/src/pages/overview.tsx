import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList } from "lucide-react";
import MonthSwitcher from "@/components/month-switcher";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

function parseMaxRange(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const s = String(val);
  const parts = s.split("-").map(Number);
  return Math.max(...parts.filter(n => !isNaN(n)), 0);
}

export default function OverviewPage() {
  const { clientId } = useSelectedClient();
  const { monthId, setMonthId } = useSelectedMonth();

  const { data: fullData } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then((r) => r.json()),
    enabled: !!monthId,
  });

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <ClipboardList className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant</p>
      </div>
    );
  }

  const month = fullData?.month;
  const trainingDays = fullData?.trainingDays ?? [];
  const weekCount = month?.weekCount ?? 4;
  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  const getLog = (ex: Exercise & { weightLogs: WeightLog[] }, weekNum: number, setNum: number) =>
    ex.weightLogs.find((l) => l.weekNumber === weekNum && l.setNumber === setNum);

  const formatCell = (ex: Exercise & { weightLogs: WeightLog[] }, weekNum: number, setNum: number) => {
    const log = getLog(ex, weekNum, setNum);
    if (!log) return "";
    if (log.skipped) return "skip";
    const isTime = (ex as any).trackingType === "time";
    const isWeighted = (ex as any).weightType === "weighted";
    if (isWeighted && log.weight != null && log.reps != null) {
      return `${log.weight}x${log.reps}${isTime ? "s" : ""}`;
    }
    if (log.reps != null) return `${log.reps}${isTime ? "s" : ""}`;
    if (log.weight != null) return `${log.weight}`;
    return "";
  };

  return (
    <div className="p-3 space-y-1">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <MonthSwitcher clientId={clientId} monthId={monthId} onChange={setMonthId} />
      </div>

      {!fullData ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
        </div>
      ) : trainingDays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <ClipboardList className="w-10 h-10 opacity-30" />
          <p className="text-sm">Geen trainingen in dit blok</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]" data-testid="table-overview">
            {trainingDays.map((day) => {
              // Compute max sets across all exercises in this day
              const exercises = day.exercises.sort((a, b) => a.sortOrder - b.sortOrder);
              
              return (
                <tbody key={day.id}>
                  {/* Day header row */}
                  <tr>
                    <td
                      colSpan={999}
                      className="bg-primary/10 font-semibold text-xs px-2 py-1.5 border-b border-border"
                    >
                      {day.name}
                    </td>
                  </tr>
                  {/* Column headers */}
                  <tr className="text-muted-foreground font-medium border-b border-border">
                    <td className="px-2 py-1 sticky left-0 bg-background z-10 min-w-[120px]">Oefening</td>
                    <td className="px-1.5 py-1 text-center w-[32px]">sets</td>
                    <td className="px-1.5 py-1 text-center w-[32px]">reps</td>
                    <td className="px-1.5 py-1 text-center w-[36px]">tempo</td>
                    <td className="px-1.5 py-1 text-center w-[28px]">rest</td>
                    <td className="px-1.5 py-1 text-center w-[24px]">rir</td>
                    {weeks.map((w) => {
                      // Find max sets for this week across all exercises
                      const maxSetsInWeek = exercises.reduce((max, ex) => {
                        const setsFromGoal = parseMaxRange(ex.sets);
                        const setsFromLogs = ex.weightLogs
                          .filter(l => l.weekNumber === w)
                          .reduce((m, l) => Math.max(m, l.setNumber), 0);
                        return Math.max(max, setsFromGoal, setsFromLogs);
                      }, 1);
                      return Array.from({ length: maxSetsInWeek }, (_, s) => (
                        <td key={`h-w${w}-s${s}`} className="px-1 py-1 text-center min-w-[52px] whitespace-nowrap">
                          {s === 0 ? `Week ${w}` : ""}
                        </td>
                      ));
                    })}
                  </tr>
                  {/* Exercise rows */}
                  {exercises.map((ex) => {
                    const isTime = (ex as any).trackingType === "time";
                    return (
                      <tr key={ex.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-2 py-1 sticky left-0 bg-background z-10 font-medium truncate max-w-[160px]" title={ex.name}>
                          {ex.name}
                        </td>
                        <td className="px-1.5 py-1 text-center text-muted-foreground tabular-nums">{ex.sets || "—"}</td>
                        <td className="px-1.5 py-1 text-center text-muted-foreground tabular-nums">
                          {ex.goalReps || "—"}{isTime ? "s" : ""}
                        </td>
                        <td className="px-1.5 py-1 text-center text-muted-foreground tabular-nums">{ex.tempo || "—"}</td>
                        <td className="px-1.5 py-1 text-center text-muted-foreground tabular-nums">{ex.rest || "—"}</td>
                        <td className="px-1.5 py-1 text-center text-muted-foreground tabular-nums">{ex.rir || "—"}</td>
                        {weeks.map((w) => {
                          const maxSetsInWeek = exercises.reduce((max, e2) => {
                            const setsFromGoal = parseMaxRange(e2.sets);
                            const setsFromLogs = e2.weightLogs
                              .filter(l => l.weekNumber === w)
                              .reduce((m, l) => Math.max(m, l.setNumber), 0);
                            return Math.max(max, setsFromGoal, setsFromLogs);
                          }, 1);
                          return Array.from({ length: maxSetsInWeek }, (_, s) => {
                            const val = formatCell(ex, w, s + 1);
                            const log = getLog(ex, w, s + 1);
                            const isSkipped = log?.skipped;
                            return (
                              <td
                                key={`w${w}-s${s}`}
                                className={`px-1 py-1 text-center tabular-nums font-mono whitespace-nowrap ${
                                  isSkipped ? "text-muted-foreground/40 line-through" : val ? "" : "text-muted-foreground/20"
                                }`}
                              >
                                {val || "·"}
                              </td>
                            );
                          });
                        })}
                      </tr>
                    );
                  })}
                  {/* Spacer between days */}
                  <tr><td colSpan={999} className="h-3"></td></tr>
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}
