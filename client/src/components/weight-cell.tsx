import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Props {
  exerciseId: number;
  weekNumber: number;
  setNumber: number;
  initialWeight: number | null;
  initialReps: number | null;
  monthId: number;
}

export default function WeightCell({
  exerciseId,
  weekNumber,
  setNumber,
  initialWeight,
  initialReps,
  monthId,
}: Props) {
  const [weight, setWeight] = useState(initialWeight !== null ? String(initialWeight) : "");
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : "");

  const upsertLog = useMutation({
    mutationFn: (data: { weight: number | null; reps: number | null }) =>
      apiRequest("POST", "/api/weight-logs", {
        exerciseId,
        weekNumber,
        setNumber,
        weight: data.weight,
        reps: data.reps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const handleBlur = useCallback(() => {
    const w = weight ? parseFloat(weight) : null;
    const r = reps ? parseInt(reps) : null;
    if (w !== initialWeight || r !== initialReps) {
      upsertLog.mutate({ weight: w, reps: r });
    }
  }, [weight, reps, initialWeight, initialReps]);

  return (
    <div
      className="flex items-center gap-0.5 rounded bg-muted/40 px-1 py-0.5"
      data-testid={`weight-cell-${exerciseId}-w${weekNumber}-s${setNumber}`}
    >
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={handleBlur}
        placeholder="kg"
        className="w-[32px] bg-transparent border-none outline-none text-center text-xs tabular-nums font-mono"
        data-testid={`input-weight-${exerciseId}-w${weekNumber}-s${setNumber}`}
      />
      <span className="text-muted-foreground text-[10px]">@</span>
      <input
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={handleBlur}
        placeholder="r"
        className="w-[20px] bg-transparent border-none outline-none text-center text-xs tabular-nums font-mono"
        data-testid={`input-reps-${exerciseId}-w${weekNumber}-s${setNumber}`}
      />
    </div>
  );
}
