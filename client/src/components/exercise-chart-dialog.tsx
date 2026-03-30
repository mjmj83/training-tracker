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

function TotalSecondsTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-2))" }}>
        Totaal: <span className="font-semibold">{data?.totalSeconds ?? "—"}s</span>
      </p>
      <p style={{ color: "hsl(var(--muted-foreground))" }}>
        Sets: <span className="font-semibold">{data?.setCount ?? "—"}</span>
      </p>
      {data?.source && <p className="text-muted-foreground mt-0.5">{data.source}</p>}
    </div>
  );
}

function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-2))" }}>
        Volume: <span className="font-semibold">{data?.volume ?? "—"} kg</span>
      </p>
      {data?.source && <p className="text-muted-foreground mt-0.5">{data.source}</p>}
    </div>
  );
}

interface Props {
  exerciseName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AbcMeasurement {
  id: number;
  date: string;
  weightKg: number | null;
}

export default function ExerciseChartDialog({ exerciseName, open, onOpenChange }: Props) {
  const { clientId } = useSelectedClient();

  const { data: blocks } = useQuery<FullMonthData[]>({
    queryKey: ["/api/clients", clientId, "all-blocks"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/all-blocks`).then((r) => r.json()),
    enabled: !!clientId && open,
  });

  const { data: abcMeasurements = [] } = useQuery<AbcMeasurement[]>({
    queryKey: ["/api/clients", clientId, "abc"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/abc`).then(r => r.json()),
    enabled: !!clientId && open,
  });

  // Get the latest bodyweight from ABC measurements
  const latestBodyweight = abcMeasurements.length > 0
    ? abcMeasurements.reduce((latest, m) => (m.date > latest.date ? m : latest), abcMeasurements[0]).weightKg
    : null;

  // Find chart data for this specific exercise across all blocks
  const chartResult = (() => {
    if (!blocks || !exerciseName) return { data: [], isRepsOnly: false, isBodyweight: false };
    const allCharts = buildExerciseCharts(blocks, latestBodyweight);
    const match = allCharts.find(c => c.name === exerciseName);
    return { data: match?.data ?? [], isRepsOnly: match?.isRepsOnly ?? false, isBodyweight: match?.isBodyweight ?? false, isTimeBased: match?.isTimeBased ?? false };
  })();
  const chartData = chartResult.data;
  const isRepsOnly = chartResult.isRepsOnly;
  const isTimeBased = chartResult.isTimeBased;
  const isBodyweight = chartResult.isBodyweight;
  const showReps = isRepsOnly || isBodyweight;
  const dataKey = showReps ? "lastSetReps" : "lastSetWeight";
  const yLabel = isTimeBased ? "s" : (showReps ? "reps" : "kg");
  const lineName = isTimeBased
    ? "Laatste set (s)"
    : (showReps ? "Laatste set (reps)" : "Laatste set (kg)");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">{exerciseName}</DialogTitle>
        </DialogHeader>
        {chartData.length > 0 ? (
          <div className="space-y-4">
            {/* Weight/Reps chart */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">{isTimeBased ? "Tijd — laatste set (seconden)" : showReps ? "Reps (laatste set)" : "Gewicht (laatste set)"}</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--chart-1))" strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 6 }} name={lineName} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Volume chart — for weighted and bodyweight exercises */}
            {!isTimeBased && (!isRepsOnly || isBodyweight) && chartData.some(d => d.volume > 0) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Volume Load (kg x reps)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 50", "dataMax + 50"]} />
                    <Tooltip content={<VolumeTooltip />} />
                    <Line type="monotone" dataKey="volume" stroke="hsl(var(--chart-2))" strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{ r: 6 }} name="Volume (kg)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Total seconds chart — for time-based exercises */}
            {isTimeBased && chartData.some(d => d.totalSeconds > 0) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Totaal seconden (alle sets)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 10", "dataMax + 10"]} />
                    <Tooltip content={<TotalSecondsTooltip />} />
                    <Line type="monotone" dataKey="totalSeconds" stroke="hsl(var(--chart-2))" strokeWidth={2}
                      dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{ r: 6 }} name="Totaal (s)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
            Nog geen data voor deze oefening
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
