import { useSelectedClient } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { useEffect, useRef, useState, useMemo } from "react";
import { BarChart3, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  const isRepsOnly = data?.isRepsOnly;
  const isTimeBased = data?.isTimeBased;
  const isBodyweight = data?.isBodyweight;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: "hsl(var(--popover))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <p className="font-medium mb-1">{label}</p>
      {isTimeBased ? (
        <>
          <p style={{ color: "hsl(var(--chart-1))" }}>
            Tijd: <span className="font-semibold">{data?.lastSetReps ?? "—"}s</span>
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Sets: <span className="font-semibold">{data?.setCount ?? "—"}</span>
          </p>
        </>
      ) : isBodyweight || isRepsOnly ? (
        <>
          <p style={{ color: "hsl(var(--chart-1))" }}>
            Reps: <span className="font-semibold">{data?.lastSetReps ?? "—"}</span>
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Sets: <span className="font-semibold">{data?.setCount ?? "—"}</span>
          </p>
        </>
      ) : (
        <>
          <p style={{ color: "hsl(var(--chart-1))" }}>
            Gewicht: <span className="font-semibold">{data?.lastSetWeight ?? "—"} kg</span>
          </p>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Reps: <span className="font-semibold">{data?.lastSetReps ?? "—"}</span>
          </p>
        </>
      )}
      {data?.source && (
        <p className="text-muted-foreground mt-0.5">{data.source}</p>
      )}
    </div>
  );
}

function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-2))" }}>Volume: <span className="font-semibold">{data?.volume ?? "—"} kg</span></p>
      {data?.source && <p className="text-muted-foreground mt-0.5">{data.source}</p>}
    </div>
  );
}

function TotalSecondsTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-2))" }}>Totaal: <span className="font-semibold">{data?.totalSeconds ?? "—"}s</span></p>
      <p style={{ color: "hsl(var(--muted-foreground))" }}>Sets: <span className="font-semibold">{data?.setCount ?? "—"}</span></p>
      {data?.source && <p className="text-muted-foreground mt-0.5">{data.source}</p>}
    </div>
  );
}

/** Build chart data points from an array of FullMonthData blocks */
export function buildExerciseCharts(blocks: FullMonthData[], latestBodyweight?: number | null): { name: string; data: any[]; isRepsOnly: boolean; isBodyweight: boolean; isTimeBased: boolean }[] {
  const exerciseMap = new Map<string, { week: string; lastSetWeight: number; lastSetReps: number | null; volume: number; setCount: number; totalSeconds: number; source: string; sortDate: string }[]>();
  const exerciseHasWeight = new Map<string, boolean>();
  const exerciseIsBodyweight = new Map<string, boolean>();
  const exerciseIsTimeBased = new Map<string, boolean>();

  for (const block of blocks) {
    const weekCount = block.month?.weekCount ?? 4;
    const blockLabel = block.month?.label ?? "";

    for (const day of block.trainingDays) {
      for (const ex of day.exercises) {
        if (ex.weightLogs.length === 0) continue;

        const isBw = ex.weightType === "bodyweight";
        if (isBw) exerciseIsBodyweight.set(ex.name, true);
        if (ex.trackingType === "time") exerciseIsTimeBased.set(ex.name, true);

        for (let w = 1; w <= weekCount; w++) {
          const weekLogs = ex.weightLogs.filter((l) => l.weekNumber === w && !l.skipped);
          if (weekLogs.length === 0) continue;

          // Filter out logs where both weight and reps are 0 or null (cleared data)
          const meaningfulLogs = weekLogs.filter(l => (l.weight != null && l.weight > 0) || (l.reps != null && l.reps > 0));
          if (meaningfulLogs.length === 0) continue;

          const lastSet = meaningfulLogs.reduce((best, l) =>
            l.setNumber > best.setNumber ? l : best
          , meaningfulLogs[0]);

          // Calculate total volume: sum of (weight * reps) for all sets
          // For bodyweight exercises, use the latest measured bodyweight
          const bwWeight = isBw && latestBodyweight ? latestBodyweight : 0;
          const volume = meaningfulLogs.reduce((sum, l) => {
            const w2 = isBw ? bwWeight : (l.weight ?? 0);
            const r = l.reps ?? 0;
            return sum + (w2 * r);
          }, 0);

          // Total seconds: sum of reps field for all sets (for time-based exercises)
          const totalSeconds = meaningfulLogs.reduce((sum, l) => sum + (l.reps ?? 0), 0);

          const weekDate = block.weekDates.find(
            (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
          );

          const dateStr = weekDate?.date || block.month?.startDate || "";
          const label = dateStr
            ? new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
            : `${blockLabel} ${day.name} Week ${w}`;

          if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, []);
          if (lastSet.weight && lastSet.weight > 0) {
            exerciseHasWeight.set(ex.name, true);
          }
          exerciseMap.get(ex.name)!.push({
            week: label,
            lastSetWeight: Math.round((lastSet.weight ?? 0) * 10) / 10,
            lastSetReps: lastSet.reps != null ? Math.round(lastSet.reps * 10) / 10 : null,
            volume: Math.round(volume * 10) / 10,
            setCount: weekLogs.length,
            totalSeconds: Math.round(totalSeconds * 10) / 10,
            source: `${blockLabel} · ${day.name} Week ${w}`,
            sortDate: dateStr || `${block.month?.startDate || "9999"}-${day.sortOrder}-${w}`,
          });
        }
      }
    }
  }

  const charts: { name: string; data: any[]; isRepsOnly: boolean; isBodyweight: boolean; isTimeBased: boolean }[] = [];
  for (const [name, points] of exerciseMap) {
    const isBw = exerciseIsBodyweight.get(name) ?? false;
    const isTime = exerciseIsTimeBased.get(name) ?? false;
    const isRepsOnly = !exerciseHasWeight.get(name) && !isBw;
    const sorted = points
      .sort((a, b) => a.sortDate.localeCompare(b.sortDate))
      .map(p => ({ ...p, isRepsOnly, isTimeBased: isTime, isBodyweight: isBw }));
    charts.push({ name, data: sorted, isRepsOnly, isBodyweight: isBw, isTimeBased: isTime });
  }
  return charts;
}

/** Build detailed set-level data for a specific exercise across all blocks */
function buildExerciseDetail(blocks: FullMonthData[], exerciseName: string) {
  const rows: { date: string; sortDate: string; block: string; day: string; week: number; set: number; weight: number | null; reps: number | null; skipped: boolean; weightType: string; trackingType: string }[] = [];

  for (const block of blocks) {
    const weekCount = block.month?.weekCount ?? 4;
    const blockLabel = block.month?.label ?? "";

    for (const day of block.trainingDays) {
      for (const ex of day.exercises) {
        if (ex.name !== exerciseName) continue;
        if (ex.weightLogs.length === 0) continue;

        for (let w = 1; w <= weekCount; w++) {
          const weekLogs = ex.weightLogs
            .filter((l) => l.weekNumber === w)
            .sort((a, b) => a.setNumber - b.setNumber);
          if (weekLogs.length === 0) continue;

          const weekDate = block.weekDates.find(
            (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
          );
          const dateStr = weekDate?.date || block.month?.startDate || "";

          for (const log of weekLogs) {
            rows.push({
              date: dateStr,
              sortDate: dateStr || `${block.month?.startDate || "9999"}-${day.sortOrder}-${w}`,
              block: blockLabel,
              day: day.name,
              week: w,
              set: log.setNumber,
              weight: log.weight,
              reps: log.reps,
              skipped: !!log.skipped,
              weightType: ex.weightType ?? "weighted",
              trackingType: ex.trackingType ?? "reps",
            });
          }
        }
      }
    }
  }

  return rows.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.set - b.set);
}

export default function ChartsPage() {
  const { clientId } = useSelectedClient();

  const [, params] = useRoute("/charts/:exerciseName");
  const highlightName = params?.exerciseName ? decodeURIComponent(params.exerciseName) : null;
  const highlightRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: blocks } = useQuery<FullMonthData[]>({
    queryKey: ["/api/clients", clientId, "all-blocks"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/all-blocks`).then((r) => r.json()),
    enabled: !!clientId,
  });

  const { data: abcData = [] } = useQuery<{ weightKg: number | null; date: string }[]>({
    queryKey: ["/api/clients", clientId, "abc"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/abc`).then(r => r.json()),
    enabled: !!clientId,
  });
  const latestBodyweight = abcData.length > 0
    ? abcData.reduce((latest, m) => (m.date > latest.date ? m : latest), abcData[0]).weightKg
    : null;

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [blocks, highlightName]);

  // Build exercise names list for search suggestions
  const exerciseNames = useMemo(() => {
    if (!blocks) return [];
    const names = new Set<string>();
    for (const block of blocks) {
      for (const day of block.trainingDays) {
        for (const ex of day.exercises) {
          if (ex.weightLogs.length > 0) names.add(ex.name);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "nl"));
  }, [blocks]);

  // Filter suggestions based on search query
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return exerciseNames.filter(name => name.toLowerCase().includes(q));
  }, [searchQuery, exerciseNames]);

  // Selected exercise for detail view
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Detail data for selected exercise
  const detailRows = useMemo(() => {
    if (!selectedExercise || !blocks) return [];
    return buildExerciseDetail(blocks, selectedExercise);
  }, [selectedExercise, blocks]);

  // Group detail rows by date for display
  const groupedDetails = useMemo(() => {
    const groups: { date: string; block: string; day: string; week: number; sets: typeof detailRows }[] = [];
    for (const row of detailRows) {
      const last = groups[groups.length - 1];
      if (last && last.date === row.date && last.day === row.day && last.week === row.week) {
        last.sets.push(row);
      } else {
        groups.push({ date: row.date, block: row.block, day: row.day, week: row.week, sets: [row] });
      }
    }
    return groups;
  }, [detailRows]);

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <BarChart3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant om charts te bekijken</p>
      </div>
    );
  }

  if (!blocks) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  const exerciseCharts = buildExerciseCharts(blocks, latestBodyweight);

  if (exerciseCharts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <BarChart3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nog geen gewichtsdata ingevuld om te visualiseren</p>
      </div>
    );
  }

  const sortedCharts = highlightName
    ? [...exerciseCharts].sort((a, b) => {
        if (a.name === highlightName) return -1;
        if (b.name === highlightName) return 1;
        return 0;
      })
    : exerciseCharts;

  // Selected exercise chart data
  const selectedChart = selectedExercise
    ? exerciseCharts.find(c => c.name === selectedExercise)
    : null;

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatSetValue = (row: typeof detailRows[0]) => {
    if (row.skipped) return "skip";
    const isTime = row.trackingType === "time";
    const isWeighted = row.weightType === "weighted";
    if (isWeighted && row.weight != null && row.reps != null) {
      return `${row.weight} x ${row.reps}${isTime ? "s" : ""}`;
    }
    if (row.reps != null) return `${row.reps}${isTime ? "s" : ""}`;
    return "—";
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold" data-testid="text-charts-title">
          Progressie overzicht
        </h1>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
            if (!e.target.value.trim()) setSelectedExercise(null);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Zoek oefening..."
          className="pl-8 pr-8 h-9 text-sm"
          data-testid="input-exercise-search"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); setSelectedExercise(null); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
            {suggestions.map(name => (
              <button
                key={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedExercise(name);
                  setSearchQuery(name);
                  setShowSuggestions(false);
                  searchInputRef.current?.blur();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                data-testid={`suggestion-${name}`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected exercise detail view */}
      {selectedExercise && selectedChart && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{selectedExercise}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const showReps = selectedChart.isRepsOnly || selectedChart.isBodyweight;
                const dataKey = showReps ? "lastSetReps" : "lastSetWeight";
                const yLabel = selectedChart.isTimeBased ? "s" : (showReps ? "reps" : "kg");
                const lineName = selectedChart.isTimeBased
                  ? "Laatste set (s)"
                  : (showReps ? "Laatste set (reps)" : "Laatste set (kg)");
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={selectedChart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        domain={["dataMin - 5", "dataMax + 5"]}
                        label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--chart-1))" strokeWidth={2}
                        dot={{ r: 4, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 6 }} name={lineName} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          {/* Volume / Total seconds chart */}
          {!selectedChart.isTimeBased && (!selectedChart.isRepsOnly || selectedChart.isBodyweight) && selectedChart.data.some((d: any) => d.volume > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Volume Load (kg x reps)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={selectedChart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 50", "dataMax + 50"]} />
                    <Tooltip content={<VolumeTooltip />} />
                    <Line type="monotone" dataKey="volume" stroke="hsl(var(--chart-2))" strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{ r: 6 }} name="Volume (kg)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {selectedChart.isTimeBased && selectedChart.data.some((d: any) => d.totalSeconds > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Totaal seconden (alle sets)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={selectedChart.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 10", "dataMax + 10"]} />
                    <Tooltip content={<TotalSecondsTooltip />} />
                    <Line type="monotone" dataKey="totalSeconds" stroke="hsl(var(--chart-2))" strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{ r: 6 }} name="Totaal (s)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detail table */}
          {groupedDetails.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Geschiedenis</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-exercise-history">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left px-4 py-2 font-medium">Datum</th>
                        <th className="text-left px-4 py-2 font-medium">Blok</th>
                        <th className="text-left px-4 py-2 font-medium">Dag</th>
                        <th className="text-center px-4 py-2 font-medium">Sets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedDetails.map((group, gi) => (
                        <tr key={gi} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDate(group.date)}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{group.block}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{group.day} Week {group.week}</td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {group.sets.map((s, si) => (
                                <span
                                  key={si}
                                  className={`inline-block px-1.5 py-0.5 rounded text-xs tabular-nums font-mono ${
                                    s.skipped ? "bg-muted text-muted-foreground/50 line-through" : "bg-muted/60"
                                  }`}
                                >
                                  {formatSetValue(s)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* All charts grid — hidden when exercise is selected */}
      {!selectedExercise && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedCharts.map((chart, i) => {
            const isHighlighted = chart.name === highlightName;
            // Bodyweight + reps_only → reps chart, weighted → weight chart, time → seconds chart
            const showReps = chart.isRepsOnly || chart.isBodyweight;
            const dataKey = showReps ? "lastSetReps" : "lastSetWeight";
            const yLabel = chart.isTimeBased ? "s" : (showReps ? "reps" : "kg");
            const lineName = chart.isTimeBased
              ? "Laatste set (s)"
              : (showReps ? "Laatste set (reps)" : "Laatste set (kg)");
            return (
              <div
                key={`${chart.name}-${i}`}
                ref={isHighlighted ? highlightRef : undefined}
              >
                <Card
                  className={`cursor-pointer transition-shadow hover:shadow-md ${isHighlighted ? "ring-2 ring-primary" : ""}`}
                  onClick={() => { setSelectedExercise(chart.name); setSearchQuery(chart.name); }}
                  data-testid={`chart-${chart.name}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{chart.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          domain={["dataMin - 5", "dataMax + 5"]}
                          label={{
                            value: yLabel,
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                          }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey={dataKey}
                          stroke="hsl(var(--chart-1))"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                          activeDot={{ r: 6 }}
                          name={lineName}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
