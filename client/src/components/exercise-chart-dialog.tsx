import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSelectedClient } from "@/lib/state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { buildExerciseCharts } from "@/pages/charts";
import type { TrainingDay, Exercise, WeightLog, WeekDate, Month } from "@shared/schema";

interface FullMonthData {
  month: Month;
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

function ChartTooltip({ active, payload, label }: any) {
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

interface Props {
  exerciseName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExerciseChartDialog({ exerciseName, open, onOpenChange }: Props) {
  const { clientId } = useSelectedClient();

  const { data: blocks } = useQuery<FullMonthData[]>({
    queryKey: ["/api/clients", clientId, "all-blocks"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/all-blocks`).then((r) => r.json()),
    enabled: !!clientId && open,
  });

  // Find chart data for this specific exercise across all blocks
  const chartData = (() => {
    if (!blocks || !exerciseName) return [];
    const allCharts = buildExerciseCharts(blocks);
    const match = allCharts.find(c => c.name === exerciseName);
    return match?.data ?? [];
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">{exerciseName}</DialogTitle>
        </DialogHeader>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
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
              <Tooltip content={<ChartTooltip />} />
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
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
            Nog geen gewichtsdata voor deze oefening
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
