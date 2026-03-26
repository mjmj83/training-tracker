import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExerciseRow from "@/components/exercise-row";
import AddExerciseRow from "@/components/add-exercise-row";
import WeekDateInput from "@/components/week-date-input";
import ConfirmDialog from "@/components/confirm-dialog";
import type { TrainingDay, Exercise, WeightLog, WeekDate } from "@shared/schema";

interface Props {
  day: TrainingDay;
  exercises: (Exercise & { weightLogs: WeightLog[] })[];
  weekDates: WeekDate[];
  monthId: number;
  weekCount: number;
  onBeforeChange: () => void;
  readOnly?: boolean;
}

export default function TrainingDaySection({ day, exercises, weekDates, monthId, weekCount, onBeforeChange, readOnly = false }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(day.name);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragSourceId = useRef<number | null>(null);
  const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

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

  const createSuperset = useMutation({
    mutationFn: (exerciseIds: number[]) =>
      apiRequest("POST", "/api/exercises/superset", { exerciseIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  const sortedExercises = [...exercises].sort((a, b) => a.sortOrder - b.sortOrder);

  // Group exercises by superset
  const groups: { groupId: number | null; exercises: typeof sortedExercises }[] = [];
  for (const ex of sortedExercises) {
    const gid = ex.supersetGroupId;
    if (gid !== null) {
      const existing = groups.find(g => g.groupId === gid);
      if (existing) {
        existing.exercises.push(ex);
      } else {
        groups.push({ groupId: gid, exercises: [ex] });
      }
    } else {
      groups.push({ groupId: null, exercises: [ex] });
    }
  }

  const handleDragStart = (exerciseId: number) => {
    if (readOnly) return;
    dragSourceId.current = exerciseId;
  };

  const handleDragOver = (e: React.DragEvent, exerciseId: number) => {
    if (readOnly) return;
    e.preventDefault();
    if (dragSourceId.current !== null && dragSourceId.current !== exerciseId) {
      setDragOverId(exerciseId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (targetExerciseId: number) => {
    if (readOnly) return;
    const sourceId = dragSourceId.current;
    if (sourceId && sourceId !== targetExerciseId) {
      onBeforeChange();
      createSuperset.mutate([sourceId, targetExerciseId]);
    }
    dragSourceId.current = null;
    setDragOverId(null);
  };

  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  return (
    <div className="mb-4" data-testid={`training-day-${day.id}`}>
      {/* Day Header / Ruler */}
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-2 mb-1">
        <button onClick={() => setIsOpen(!isOpen)} className="text-muted-foreground" data-testid={`toggle-day-${day.id}`}>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {!readOnly && isEditingName ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onBeforeChange(); updateDay.mutate({ name }); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onBeforeChange(); updateDay.mutate({ name }); } }}
            className="h-7 text-sm font-semibold bg-transparent border-none focus-visible:ring-1 max-w-xs"
            autoFocus
            data-testid={`input-day-name-${day.id}`}
          />
        ) : (
          <span
            className={`text-sm font-semibold flex-1 ${!readOnly ? "cursor-pointer" : ""}`}
            onClick={() => { if (!readOnly) setIsEditingName(true); }}
            data-testid={`text-day-name-${day.id}`}
          >
            {day.name}
          </span>
        )}
        {!readOnly && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteDayConfirm(true)}
            data-testid={`button-delete-day-${day.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {!readOnly && (
        <ConfirmDialog
          open={showDeleteDayConfirm}
          onOpenChange={setShowDeleteDayConfirm}
          title="Are you sure?"
          description={`"${day.name}" wordt verwijderd met alle oefeningen en ingevulde data.`}
          onConfirm={() => {
            onBeforeChange();
            deleteDay.mutate();
            setShowDeleteDayConfirm(false);
          }}
        />
      )}

      {/* Exercise Table */}
      {isOpen && (
        <div>
          <table className="w-full text-sm border-collapse" data-testid={`table-exercises-${day.id}`}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground min-w-[260px]">Oefening</th>
                {weeks.map((w) => (
                  <th
                    key={w}
                    className={`text-center py-1.5 px-1 font-medium text-muted-foreground min-w-[120px] transition-colors ${hoveredWeek === w ? "bg-primary/10" : ""}`}
                    onMouseEnter={() => setHoveredWeek(w)}
                    onMouseLeave={() => setHoveredWeek(null)}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>W{w}</span>
                      <WeekDateInput
                        monthId={monthId}
                        trainingDayId={day.id}
                        weekNumber={w}
                        weekDates={weekDates}
                        readOnly={readOnly}
                      />
                    </div>
                  </th>
                ))}
                <th className="w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, gi) => {
                const isSuperset = group.groupId !== null && group.exercises.length > 1;
                return group.exercises.map((ex, ei) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    weightLogs={ex.weightLogs}
                    monthId={monthId}
                    weekCount={weekCount}
                    isSuperset={isSuperset}
                    isFirstInSuperset={isSuperset && ei === 0}
                    isLastInSuperset={isSuperset && ei === group.exercises.length - 1}
                    isDragOver={dragOverId === ex.id}
                    onDragStart={() => handleDragStart(ex.id)}
                    onDragOver={(e) => handleDragOver(e, ex.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(ex.id)}
                    onBeforeChange={onBeforeChange}
                    hoveredWeek={hoveredWeek}
                    onWeekHover={setHoveredWeek}
                    readOnly={readOnly}
                  />
                ));
              })}
            </tbody>
          </table>
          {!readOnly && (
            <AddExerciseRow trainingDayId={day.id} monthId={monthId} sortOrder={exercises.length} onBeforeChange={onBeforeChange} />
          )}
        </div>
      )}
    </div>
  );
}
