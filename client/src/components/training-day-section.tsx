import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExerciseRow from "@/components/exercise-row";
import AddExerciseRow from "@/components/add-exercise-row";
import WeekDateInput from "@/components/week-date-input";
import type { TrainingDay, Exercise, WeightLog, WeekDate } from "@shared/schema";

interface Props {
  day: TrainingDay;
  exercises: (Exercise & { weightLogs: WeightLog[] })[];
  weekDates: WeekDate[];
  monthId: number;
}

export default function TrainingDaySection({ day, exercises, weekDates, monthId }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(day.name);

  const updateDay = useMutation({
    mutationFn: (data: { name: string }) =>
      apiRequest("PATCH", `/api/training-days/${day.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setIsEditingName(false);
    },
  });

  const deleteDay = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/training-days/${day.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  // Determine max sets across all exercises to know how many weight sub-columns to show per week
  const sortedExercises = [...exercises].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mb-4" data-testid={`training-day-${day.id}`}>
      {/* Day Header / Ruler */}
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-2 mb-1">
        <button onClick={() => setIsOpen(!isOpen)} className="text-muted-foreground" data-testid={`toggle-day-${day.id}`}>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {isEditingName ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => updateDay.mutate({ name })}
            onKeyDown={(e) => e.key === "Enter" && updateDay.mutate({ name })}
            className="h-7 text-sm font-semibold bg-transparent border-none focus-visible:ring-1 max-w-xs"
            autoFocus
            data-testid={`input-day-name-${day.id}`}
          />
        ) : (
          <span
            className="text-sm font-semibold cursor-pointer flex-1"
            onClick={() => setIsEditingName(true)}
            data-testid={`text-day-name-${day.id}`}
          >
            {day.name}
          </span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (confirm(`"${day.name}" verwijderen met alle oefeningen?`)) {
              deleteDay.mutate();
            }
          }}
          data-testid={`button-delete-day-${day.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Exercise Table */}
      {isOpen && (
        <div>
          <table className="w-full text-xs border-collapse" data-testid={`table-exercises-${day.id}`}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-[200px] min-w-[200px]">Oefening</th>
                <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-[45px]">Sets</th>
                <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-[45px]">Reps</th>
                <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-[60px]">Tempo</th>
                <th className="text-center py-1.5 px-1 font-medium text-muted-foreground w-[45px]">Rest</th>
                {[1, 2, 3, 4].map((w) => (
                  <th key={w} className="text-center py-1.5 px-1 font-medium text-muted-foreground min-w-[120px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>W{w}</span>
                      <WeekDateInput
                        monthId={monthId}
                        trainingDayId={day.id}
                        weekNumber={w}
                        weekDates={weekDates}
                      />
                    </div>
                  </th>
                ))}
                <th className="w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {sortedExercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  weightLogs={ex.weightLogs}
                  monthId={monthId}
                />
              ))}
            </tbody>
          </table>
          <AddExerciseRow trainingDayId={day.id} monthId={monthId} sortOrder={exercises.length} />
        </div>
      )}
    </div>
  );
}
