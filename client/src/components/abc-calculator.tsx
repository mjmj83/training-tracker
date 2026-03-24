import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calculator, Trash2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import ConfirmDialog from "@/components/confirm-dialog";
import type { AbcMeasurement } from "@shared/schema";

interface Props {
  clientId: number;
}

// US Army Body Composition formulas (2023 simplified one-site method)
// Male:   BF% = -26.97 - (0.12 × weight_lbs) + (1.99 × abdomen_inches)
// Female: BF% = -9.15 - (0.015 × weight_lbs) + (1.27 × abdomen_inches)
function calculateBodyFat(gender: string, weightKg: number, abdomenCm: number): number {
  const weightLbs = weightKg * 2.20462;
  const abdomenInches = abdomenCm / 2.54;

  let bf: number;
  if (gender === "male") {
    bf = -26.97 - (0.12 * weightLbs) + (1.99 * abdomenInches);
  } else {
    bf = -9.15 - (0.015 * weightLbs) + (1.27 * abdomenInches);
  }
  return Math.round(bf * 10) / 10; // 1 decimal
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-1))" }}>Vetpercentage: <span className="font-semibold">{d?.bodyFatPct}%</span></p>
      <p className="text-muted-foreground">Gewicht: {d?.weightKg} kg</p>
      <p className="text-muted-foreground">Buikomtrek: {d?.abdomenCm} cm</p>
    </div>
  );
}

export default function AbcCalculator({ clientId }: Props) {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [weightKg, setWeightKg] = useState("");
  const [abdomenCm, setAbdomenCm] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: measurements = [] } = useQuery<AbcMeasurement[]>({
    queryKey: ["/api/clients", clientId, "abc"],
    queryFn: () => apiRequest("GET", `/api/clients/${clientId}/abc`).then(r => r.json()),
  });

  const addMeasurement = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/abc", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "abc"] });
      setWeightKg("");
      setAbdomenCm("");
    },
  });

  const deleteMeasurement = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/abc/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "abc"] });
    },
  });

  const handleCalculate = () => {
    const w = parseFloat(weightKg);
    const a = parseFloat(abdomenCm);
    if (!w || !a || !date) return;
    const bf = calculateBodyFat(gender, w, a);
    addMeasurement.mutate({
      clientId, date, gender, weightKg: w, abdomenCm: a, bodyFatPct: bf,
    });
  };

  // Preview calculation
  const previewBf = weightKg && abdomenCm
    ? calculateBodyFat(gender, parseFloat(weightKg), parseFloat(abdomenCm))
    : null;

  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map(m => ({
    date: new Date(m.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
    bodyFatPct: m.bodyFatPct,
    weightKg: m.weightKg,
    abdomenCm: m.abdomenCm,
  }));

  return (
    <div className="space-y-6" data-testid="abc-calculator">
      {/* Input form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Nieuwe meting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Gender */}
          <div className="flex gap-1">
            <button
              onClick={() => setGender("male")}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                gender === "male" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
              data-testid="button-gender-male"
            >
              Man
            </button>
            <button
              onClick={() => setGender("female")}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                gender === "female" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
              data-testid="button-gender-female"
            >
              Vrouw
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs h-8" data-testid="input-abc-date" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Gewicht (kg)</label>
              <Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                placeholder="bijv. 85" className="text-xs h-8" data-testid="input-abc-weight" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Buikomtrek (cm)</label>
              <Input type="number" step="0.5" value={abdomenCm} onChange={(e) => setAbdomenCm(e.target.value)}
                placeholder="bijv. 88" className="text-xs h-8" data-testid="input-abc-abdomen" />
            </div>
          </div>

          {/* Preview */}
          {previewBf !== null && (
            <div className="bg-muted/50 rounded-md px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground">Geschat vetpercentage: </span>
              <span className="text-lg font-bold text-primary">{previewBf}%</span>
            </div>
          )}

          <Button size="sm" onClick={handleCalculate} disabled={!weightKg || !abdomenCm || !date}
            className="w-full text-xs" data-testid="button-abc-save">
            Meting opslaan
          </Button>
        </CardContent>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              Vetpercentage verloop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 2", "dataMax + 2"]}
                  label={{ value: "%", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="bodyFatPct" stroke="hsl(var(--chart-1))" strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {sorted.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Metingen ({sorted.length})</h3>
          <div className="border border-border rounded-md divide-y divide-border">
            {[...sorted].reverse().map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2 text-xs group">
                <span className="text-muted-foreground w-[70px]">
                  {new Date(m.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="font-semibold text-primary">{m.bodyFatPct}%</span>
                <span className="text-muted-foreground">{m.weightKg} kg</span>
                <span className="text-muted-foreground">{m.abdomenCm} cm</span>
                <span className="text-muted-foreground/60">{m.gender === "male" ? "M" : "V"}</span>
                <div className="flex-1" />
                <button
                  onClick={() => setConfirmDeleteId(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  data-testid={`button-delete-abc-${m.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Are you sure?"
        description="Deze meting wordt permanent verwijderd."
        onConfirm={() => {
          if (confirmDeleteId) deleteMeasurement.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
