import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WeightCell from "@/components/weight-cell";
import type { Exercise, WeightLog } from "@shared/schema";

interface Props {
  exercise: Exercise;
  weightLogs: WeightLog[];
  monthId: number;
}

export default function ExerciseRow({ exercise, weightLogs, monthId }: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [goalReps, setGoalReps] = useState(exercise.goalReps);
  const [tempo, setTempo] = useState(exercise.tempo ?? "");
  const [rest, setRest] = useState(exercise.rest ?? 60);

  const updateExercise = useMutation({
    mutationFn: (data: Partial<Exercise>) =>
      apiRequest("PATCH", `/api/exercises/${exercise.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const deleteExercise = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/exercises/${exercise.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const handleBlur = useCallback(
    (field: string, value: any) => {
      updateExercise.mutate({ [field]: value });
    },
    [updateExercise]
  );

  // Get weight log for a specific week and set
  const getLog = (weekNumber: number, setNumber: number): WeightLog | undefined => {
    return weightLogs.find(
      (l) => l.weekNumber === weekNumber && l.setNumber === setNumber
    );
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors group" data-testid={`exercise-row-${exercise.id}`}>
      {/* Exercise Name */}
      <td className="py-1 px-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur("name", name)}
          className="w-full bg-transparent border-none outline-none text-xs font-medium"
          data-testid={`input-exercise-name-${exercise.id}`}
        />
      </td>

      {/* Sets */}
      <td className="py-1 px-1 text-center">
        <input
          type="number"
          min={1}
          max={5}
          value={sets}
          onChange={(e) => setSets(parseInt(e.target.value) || 1)}
          onBlur={() => handleBlur("sets", sets)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-sets-${exercise.id}`}
        />
      </td>

      {/* Goal Reps */}
      <td className="py-1 px-1 text-center">
        <input
          type="number"
          min={1}
          max={15}
          value={goalReps}
          onChange={(e) => setGoalReps(parseInt(e.target.value) || 1)}
          onBlur={() => handleBlur("goalReps", goalReps)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-reps-${exercise.id}`}
        />
      </td>

      {/* Tempo */}
      <td className="py-1 px-1 text-center">
        <input
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          onBlur={() => handleBlur("tempo", tempo)}
          className="w-full bg-transparent border-none outline-none text-center text-xs"
          placeholder="—"
          data-testid={`input-tempo-${exercise.id}`}
        />
      </td>

      {/* Rest (seconds) */}
      <td className="py-1 px-1 text-center">
        <input
          type="number"
          min={5}
          max={90}
          step={5}
          value={rest}
          onChange={(e) => setRest(parseInt(e.target.value) || 60)}
          onBlur={() => handleBlur("rest", rest)}
          className="w-full bg-transparent border-none outline-none text-center text-xs tabular-nums"
          data-testid={`input-rest-${exercise.id}`}
        />
      </td>

      {/* Weight columns W1-W4 */}
      {[1, 2, 3, 4].map((weekNum) => (
        <td key={weekNum} className="py-1 px-1">
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: sets }, (_, i) => i + 1).map((setNum) => {
              const log = getLog(weekNum, setNum);
              return (
                <WeightCell
                  key={`${weekNum}-${setNum}`}
                  exerciseId={exercise.id}
                  weekNumber={weekNum}
                  setNumber={setNum}
                  initialWeight={log?.weight ?? null}
                  initialReps={log?.reps ?? null}
                  monthId={monthId}
                />
              );
            })}
          </div>
        </td>
      ))}

      {/* Delete */}
      <td className="py-1 px-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => deleteExercise.mutate()}
          data-testid={`button-delete-exercise-${exercise.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  );
}
