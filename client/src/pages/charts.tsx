import { useSelectedClient } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { useEffect, useRef } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: "hsl(var(--popover))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <p className="font-medium mb-1">{label}</p>
      {isRepsOnly ? (
        <p style={{ color: "hsl(var(--chart-1))" }}>
          Reps: <span className="font-semibold">{data?.lastSetReps ?? "—"}</span>
        </p>
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

/** Build chart data points from an array of FullMonthData blocks */
export function buildExerciseCharts(blocks: FullMonthData[]): { name: string; data: any[]; isRepsOnly: boolean }[] {
  const exerciseMap = new Map<string, { week: string; lastSetWeight: number; lastSetReps: number | null; source: string; sortDate: string }[]>();
  const exerciseHasWeight = new Map<string, boolean>();

  for (const block of blocks) {
    const weekCount = block.month?.weekCount ?? 4;
    const blockLabel = block.month?.label ?? "";

    for (const day of block.trainingDays) {
      for (const ex of day.exercises) {
        if (ex.weightLogs.length === 0) continue;

        for (let w = 1; w <= weekCount; w++) {
          const weekLogs = ex.weightLogs.filter((l) => l.weekNumber === w);
          if (weekLogs.length === 0) continue;

          const lastSet = weekLogs.reduce((best, l) =>
            l.setNumber > best.setNumber ? l : best
          , weekLogs[0]);

          const weekDate = block.weekDates.find(
            (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
          );

          const dateStr = weekDate?.date || block.month?.startDate || "";
          const label = dateStr
            ? new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
            : `${blockLabel} ${day.name} W${w}`;

          if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, []);
          if (lastSet.weight && lastSet.weight > 0) {
            exerciseHasWeight.set(ex.name, true);
          }
          exerciseMap.get(ex.name)!.push({
            week: label,
            lastSetWeight: lastSet.weight ?? 0,
            lastSetReps: lastSet.reps,
            source: `${blockLabel} · ${day.name} W${w}`,
            sortDate: dateStr || `${block.month?.startDate || "9999"}-${day.sortOrder}-${w}`,
          });
        }
      }
    }
  }

  const charts: { name: string; data: any[]; isRepsOnly: boolean }[] = [];
  for (const [name, points] of exerciseMap) {
    const isRepsOnly = !exerciseHasWeight.get(name);
    const sorted = points
      .sort((a, b) => a.sortDate.localeCompare(b.sortDate))
      .map(p => ({ ...p, isRepsOnly }));
    charts.push({ name, data: sorted, isRepsOnly });
  }
  return charts;
}

export default function ChartsPage() {
  const { clientId } = useSelectedClient();

  const [, params] = useRoute("/charts/:exerciseName");
  const highlightName = params?.exerciseName ? decodeURIComponent(params.exerciseName) : null;
  const highlightRef = useRef<HTMLDivElement>(null);

  const { data: blocks } = useQuery<FullMonthData[]>({
    queryKey: ["/api/clients", clientId, "all-blocks"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/all-blocks`).then((r) => r.json()),
    enabled: !!clientId,
  });

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [blocks, highlightName]);

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

  const exerciseCharts = buildExerciseCharts(blocks);

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

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold" data-testid="text-charts-title">
        Progressie overzicht
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedCharts.map((chart, i) => {
          const isHighlighted = chart.name === highlightName;
          const dataKey = chart.isRepsOnly ? "lastSetReps" : "lastSetWeight";
          const yLabel = chart.isRepsOnly ? "reps" : "kg";
          const lineName = chart.isRepsOnly ? "Laatste set (reps)" : "Laatste set (kg)";
          return (
            <div
              key={`${chart.name}-${i}`}
              ref={isHighlighted ? highlightRef : undefined}
            >
              <Card
                className={isHighlighted ? "ring-2 ring-primary" : ""}
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
    </div>
  );
}
