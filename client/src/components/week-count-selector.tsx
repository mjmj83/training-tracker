import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient } from "@/lib/state";

interface Props {
  monthId: number;
  currentCount: number;
}

export default function WeekCountSelector({ monthId, currentCount }: Props) {
  const { clientId } = useSelectedClient();

  const updateMonth = useMutation({
    mutationFn: (weekCount: number) =>
      apiRequest("PATCH", `/api/months/${monthId}`, { weekCount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "months"] });
    },
  });

  return (
    <div className="flex items-center gap-2" data-testid="week-count-selector">
      <span className="text-xs text-muted-foreground">Weken:</span>
      <div className="flex gap-0.5">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => updateMonth.mutate(n)}
            className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
              currentCount === n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-weeks-${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
