import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dumbbell } from "lucide-react";
import TrainingDaySection from "@/components/training-day-section";
import AddTrainingDay from "@/components/add-training-day";
import type { TrainingDay, Exercise, WeightLog, WeekDate } from "@shared/schema";

interface FullMonthData {
  trainingDays: (TrainingDay & {
    exercises: (Exercise & { weightLogs: WeightLog[] })[];
  })[];
  weekDates: WeekDate[];
}

export default function TrainingPage() {
  const { clientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();

  const { data, isLoading } = useQuery<FullMonthData>({
    queryKey: ["/api/months", monthId, "full"],
    queryFn: () => apiRequest("GET", `/api/months/${monthId}/full`).then((r) => r.json()),
    enabled: !!monthId,
  });

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een klant in de zijbalk</p>
      </div>
    );
  }

  if (!monthId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Dumbbell className="w-10 h-10 opacity-30" />
        <p className="text-sm">Selecteer een maand of maak een nieuwe aan</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  const trainingDays = data?.trainingDays ?? [];
  const weekDates = data?.weekDates ?? [];

  return (
    <div className="p-4 space-y-2">
      {trainingDays
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((day) => (
          <TrainingDaySection
            key={day.id}
            day={day}
            exercises={day.exercises}
            weekDates={weekDates.filter((wd) => wd.trainingDayId === day.id)}
            monthId={monthId}
          />
        ))}
      <AddTrainingDay monthId={monthId} sortOrder={trainingDays.length} />
    </div>
  );
}
