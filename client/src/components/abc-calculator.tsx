import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calculator, Trash2, TrendingDown, Ruler, Weight } from "lucide-react";
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

// US Army AR 600-9 Body Composition formulas
// All inputs converted to imperial (inches / lbs) before calculation
// Male:   %BF = 86.010 × log10(waist − neck) − 70.041 × log10(height) + 36.76
// Female: %BF = 163.205 × log10(waist + hip − neck) − 97.684 × log10(height) − 78.387
function calculateBodyFat(
  gender: string,
  heightCm: number,
  neckCm: number,
  abdomenCm: number,
  hipCm?: number,
): number {
  const heightIn = heightCm / 2.54;
  const neckIn = neckCm / 2.54;
  const waistIn = abdomenCm / 2.54;
  const hipIn = hipCm ? hipCm / 2.54 : 0;

  let bf: number;
  if (gender === "male") {
    const circumferenceValue = waistIn - neckIn;
    if (circumferenceValue <= 0) return 0;
    bf = 86.010 * Math.log10(circumferenceValue) - 70.041 * Math.log10(heightIn) + 36.76;
  } else {
    const circumferenceValue = waistIn + hipIn - neckIn;
    if (circumferenceValue <= 0) return 0;
    bf = 163.205 * Math.log10(circumferenceValue) - 97.684 * Math.log10(heightIn) - 78.387;
  }
  return Math.round(bf * 10) / 10;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: "hsl(var(--chart-1))" }}>Vetpercentage: <span className="font-semibold">{d?.bodyFatPct}%</span></p>
      <p className="text-muted-foreground">Lengte: {d?.heightCm} cm</p>
      <p className="text-muted-foreground">Nek: {d?.neckCm} cm</p>
      <p className="text-muted-foreground">Buik: {d?.abdomenCm} cm</p>
      {d?.hipCm ? <p className="text-muted-foreground">Heup: {d.hipCm} cm</p> : null}
      {d?.weightKg ? <p className="text-muted-foreground">Gewicht: {d.weightKg} kg</p> : null}
    </div>
  );
}

function SimpleTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border px-3 py-1.5 text-xs" style={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold" style={{ color: payload[0]?.stroke }}>{payload[0]?.value}{unit}</p>
    </div>
  );
}

function MiniChart({ title, icon, data, dataKey, unit, color }: {
  title: string; icon: React.ReactNode; data: any[]; dataKey: string; unit: string; color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip content={<SimpleTooltip unit={unit} />} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
              dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function AbcCalculator({ clientId }: Props) {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [abdomenCm, setAbdomenCm] = useState("");
  const [hipCm, setHipCm] = useState("");
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
      // Keep height and neck — they rarely change between sessions
      setWeightKg("");
      setAbdomenCm("");
      setHipCm("");
    },
  });

  const deleteMeasurement = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/abc/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "abc"] });
    },
  });

  const canCalculate = () => {
    const h = parseFloat(heightCm);
    const n = parseFloat(neckCm);
    const a = parseFloat(abdomenCm);
    if (!h || !n || !a || !date) return false;
    if (gender === "female") {
      const hip = parseFloat(hipCm);
      if (!hip) return false;
    }
    return true;
  };

  const handleCalculate = () => {
    const h = parseFloat(heightCm);
    const n = parseFloat(neckCm);
    const a = parseFloat(abdomenCm);
    const w = weightKg ? parseFloat(weightKg) : undefined;
    const hip = gender === "female" ? parseFloat(hipCm) : undefined;
    if (!h || !n || !a || !date) return;
    if (gender === "female" && !hip) return;

    const bf = calculateBodyFat(gender, h, n, a, hip);
    addMeasurement.mutate({
      clientId, date, gender,
      weightKg: w || null,
      heightCm: h,
      neckCm: n,
      abdomenCm: a,
      hipCm: hip || null,
      bodyFatPct: bf,
    });
  };

  // Preview calculation
  const previewBf = (() => {
    const h = parseFloat(heightCm);
    const n = parseFloat(neckCm);
    const a = parseFloat(abdomenCm);
    if (!h || !n || !a) return null;
    if (gender === "female") {
      const hip = parseFloat(hipCm);
      if (!hip) return null;
      return calculateBodyFat(gender, h, n, a, hip);
    }
    return calculateBodyFat(gender, h, n, a);
  })();

  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map(m => ({
    date: new Date(m.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
    bodyFatPct: m.bodyFatPct,
    heightCm: m.heightCm,
    neckCm: m.neckCm,
    abdomenCm: m.abdomenCm,
    hipCm: m.hipCm,
    weightKg: m.weightKg,
  }));

  return (
    <div className="space-y-6" data-testid="abc-calculator">
      {/* Input form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Nieuwe meting (AR 600-9)
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

          {/* Row 1: Datum + Lengte + Gewicht (optional) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Datum</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs h-8" data-testid="input-abc-date" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Lengte (cm)</label>
              <Input type="number" step="0.5" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                placeholder="bijv. 180" className="text-xs h-8" data-testid="input-abc-height" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Gewicht (kg) <span className="normal-case opacity-60">optioneel</span></label>
              <Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                placeholder="bijv. 85" className="text-xs h-8" data-testid="input-abc-weight" />
            </div>
          </div>

          {/* Row 2: Nek + Buik + Heup (vrouw) */}
          <div className={`grid gap-2 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Nek (cm)</label>
              <Input type="number" step="0.5" value={neckCm} onChange={(e) => setNeckCm(e.target.value)}
                placeholder="bijv. 38" className="text-xs h-8" data-testid="input-abc-neck" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Buikomtrek (cm)</label>
              <Input type="number" step="0.5" value={abdomenCm} onChange={(e) => setAbdomenCm(e.target.value)}
                placeholder="bijv. 88" className="text-xs h-8" data-testid="input-abc-abdomen" />
            </div>
            {gender === "female" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Heup (cm)</label>
                <Input type="number" step="0.5" value={hipCm} onChange={(e) => setHipCm(e.target.value)}
                  placeholder="bijv. 100" className="text-xs h-8" data-testid="input-abc-hip" />
              </div>
            )}
          </div>

          {/* Preview */}
          {previewBf !== null && (
            <div className="bg-muted/50 rounded-md px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground">Geschat vetpercentage: </span>
              <span className="text-lg font-bold text-primary">{previewBf}%</span>
            </div>
          )}

          <Button size="sm" onClick={handleCalculate} disabled={!canCalculate()}
            className="w-full text-xs" data-testid="button-abc-save">
            Meting opslaan
          </Button>
        </CardContent>
      </Card>

      {/* Charts */}
      {chartData.length > 0 && (
        <>
          <MiniChart title="Vetpercentage verloop" icon={<TrendingDown className="w-4 h-4 text-primary" />}
            data={chartData} dataKey="bodyFatPct" unit="%" color="hsl(var(--chart-1))" />
          <MiniChart title="Nekomtrek" icon={<Ruler className="w-4 h-4 text-primary" />}
            data={chartData} dataKey="neckCm" unit=" cm" color="hsl(var(--chart-2))" />
          <MiniChart title="Buikomtrek" icon={<Ruler className="w-4 h-4 text-primary" />}
            data={chartData} dataKey="abdomenCm" unit=" cm" color="hsl(var(--chart-3))" />
          {chartData.some(d => d.weightKg) && (
            <MiniChart title="Gewicht" icon={<Weight className="w-4 h-4 text-primary" />}
              data={chartData.filter(d => d.weightKg)} dataKey="weightKg" unit=" kg" color="hsl(var(--chart-4))" />
          )}
        </>
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
                <span className="text-muted-foreground">nek {m.neckCm}</span>
                <span className="text-muted-foreground">buik {m.abdomenCm}</span>
                {m.hipCm ? <span className="text-muted-foreground">heup {m.hipCm}</span> : null}
                {m.weightKg ? <span className="text-muted-foreground">{m.weightKg} kg</span> : null}
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
        title="Meting verwijderen?"
        description="Deze meting wordt permanent verwijderd."
        onConfirm={() => {
          if (confirmDeleteId) deleteMeasurement.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
