import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

// Custom tooltip to show weight + reps on hover
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
    </div>
  );
}

export default function ChartsPage() {
  const { clientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();

  const { data } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then((r) => r.json()),
    enabled: !!monthId,
  });

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

  // Build chart data: last set weight per week for each exercise
  const exerciseCharts: {
    name: string;
    day: string;
    data: { week: string; lastSetWeight: number; lastSetReps: number | null }[];
  }[] = [];

  for (const day of data.trainingDays) {
    for (const ex of day.exercises) {
      if (ex.weightLogs.length === 0) continue;

      const weekData: { week: string; lastSetWeight: number; lastSetReps: number | null }[] = [];

      for (let w = 1; w <= weekCount; w++) {
        const weekLogs = ex.weightLogs.filter((l) => l.weekNumber === w);
        if (weekLogs.length === 0) continue;

        // Get the last set (highest set number)
        const lastSet = weekLogs.reduce((best, l) =>
          l.setNumber > best.setNumber ? l : best
        , weekLogs[0]);

        const weekDate = data.weekDates.find(
          (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
        );

        weekData.push({
          week: weekDate?.date
            ? new Date(weekDate.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
            : `W${w}`,
          lastSetWeight: lastSet.weight ?? 0,
          lastSetReps: lastSet.reps,
        });
      }

      if (weekData.length > 0) {
        exerciseCharts.push({ name: ex.name, day: day.name, data: weekData });
      }
    }
  }

  if (exerciseCharts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <BarChart3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Nog geen gewichtsdata ingevuld om te visualiseren</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold" data-testid="text-charts-title">
        Progressie overzicht
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {exerciseCharts.map((chart, i) => (
          <Card key={`${chart.name}-${i}`} data-testid={`chart-${chart.name}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {chart.name}
                <span className="text-muted-foreground font-normal ml-2 text-xs">{chart.day}</span>
              </CardTitle>
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
        ))}
      </div>
    </div>
  );
}
