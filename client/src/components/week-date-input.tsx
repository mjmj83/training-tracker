import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WeekDate } from "@shared/schema";

interface Props {
  monthId: number;
  trainingDayId: number;
  weekNumber: number;
  weekDates: WeekDate[];
}

export default function WeekDateInput({ monthId, trainingDayId, weekNumber, weekDates }: Props) {
  const existing = weekDates.find(
    (wd) => wd.trainingDayId === trainingDayId && wd.weekNumber === weekNumber
  );
  const [date, setDate] = useState(existing?.date ?? "");

  const upsertDate = useMutation({
    mutationFn: (dateValue: string) =>
      apiRequest("POST", "/api/week-dates", {
        monthId,
        trainingDayId,
        weekNumber,
        date: dateValue || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

  return (
    <input
      type="date"
      value={date}
      onChange={(e) => {
        setDate(e.target.value);
        upsertDate.mutate(e.target.value);
      }}
      className="bg-transparent border-none outline-none text-[10px] text-muted-foreground text-center w-[100px] cursor-pointer"
      data-testid={`input-weekdate-${trainingDayId}-w${weekNumber}`}
    />
  );
}
