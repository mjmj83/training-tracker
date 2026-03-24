import { useSelectedClient, useSelectedMonth } from "@/lib/state";
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
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: "hsl(var(--popover))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-1))" }}>
        Gewicht: <span className="font-semibold">{data?.lastSetWeight ?? "—"} kg</span>
      </p>
      <p style={{ color: "hsl(var(--muted-foreground))" }}>
        Reps: <span className="font-semibold">{data?.lastSetReps ?? "—"}</span>
      </p>
      {data?.source && (
        <p className="text-muted-foreground mt-0.5">{data.source}</p>
      )}
    </div>
  );
}

export default function ChartsPage() {
  const { clientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();

  const [, params] = useRoute("/charts/:exerciseName");
  const highlightName = params?.exerciseName ? decodeURIComponent(params.exerciseName) : null;
  const highlightRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then((r) => r.json()),
    enabled: !!monthId,
  });

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [data, highlightName]);

  if (!clientId || !monthId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <BarChart3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant en maand om charts te bekijken</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  const weekCount = data.month?.weekCount ?? 4;

  // Collect all data points grouped by exercise NAME (not by day)
  const exerciseMap = new Map<string, { week: string; lastSetWeight: number; lastSetReps: number | null; source: string; sortDate: string }[]>();

  for (const day of data.trainingDays) {
    for (const ex of day.exercises) {
      if (ex.weightLogs.length === 0) continue;

      for (let w = 1; w <= weekCount; w++) {
        const weekLogs = ex.weightLogs.filter((l) => l.weekNumber === w);
        if (weekLogs.length === 0) continue;

        const lastSet = weekLogs.reduce((best, l) =>
          l.setNumber > best.setNumber ? l : best
        , weekLogs[0]);

        const weekDate = data.weekDates.find(
          (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
        );

        const dateStr = weekDate?.date || "";
        const label = dateStr
          ? new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
          : `${day.name} W${w}`;

        if (!exerciseMap.has(ex.name)) exerciseMap.set(ex.name, []);
        exerciseMap.get(ex.name)!.push({
          week: label,
          lastSetWeight: lastSet.weight ?? 0,
          lastSetReps: lastSet.reps,
          source: `${day.name} W${w}`,
          sortDate: dateStr || `${day.sortOrder}-${w}`,
        });
      }
    }
  }

  // Build chart data sorted by date
  const exerciseCharts: { name: string; data: any[] }[] = [];
  for (const [name, points] of exerciseMap) {
    const sorted = points.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    exerciseCharts.push({ name, data: sorted });
  }

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
                          value: "kg",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="lastSetWeight"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                        activeDot={{ r: 6 }}
                        name="Laatste set (kg)"
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
