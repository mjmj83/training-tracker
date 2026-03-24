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
  Legend,
} from "recharts";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

export default function ChartsPage() {
  const { clientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();

  const { data: months = [] } = useQuery<Month[]>({
    queryKey: ["/api/clients", clientId, "months"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/months`).then((r) => r.json()),
    enabled: !!clientId,
  });

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

  // Collect all exercises with weight data
  const exerciseCharts: {
    name: string;
    data: { week: string; maxWeight: number; totalVolume: number }[];
  }[] = [];

  for (const day of data.trainingDays) {
    for (const ex of day.exercises) {
      if (ex.weightLogs.length === 0) continue;

      const weekData: { week: string; maxWeight: number; totalVolume: number }[] = [];

      for (let w = 1; w <= 4; w++) {
        const weekLogs = ex.weightLogs.filter((l) => l.weekNumber === w);
        if (weekLogs.length === 0) continue;

        const maxWeight = Math.max(...weekLogs.map((l) => l.weight ?? 0));
        const totalVolume = weekLogs.reduce(
          (acc, l) => acc + (l.weight ?? 0) * (l.reps ?? 0),
          0
        );

        const weekDate = data.weekDates.find(
          (wd) => wd.trainingDayId === day.id && wd.weekNumber === w
        );

        weekData.push({
          week: weekDate?.date ? new Date(weekDate.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : `W${w}`,
          maxWeight,
          totalVolume,
        });
      }

      if (weekData.length > 0) {
        exerciseCharts.push({ name: ex.name, data: weekData });
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
        {exerciseCharts.map((chart) => (
          <Card key={chart.name} data-testid={`chart-${chart.name}`}>
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
                    yAxisId="weight"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "kg",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                    }}
                  />
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    label={{
                      value: "vol",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="maxWeight"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Max gewicht (kg)"
                  />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="totalVolume"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Volume (kg × reps)"
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
