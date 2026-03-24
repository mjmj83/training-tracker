import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient } from "@/lib/state";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" data-testid="button-settings">
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instellingen</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Aantal weken</p>
          <div className="flex gap-1">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => updateMonth.mutate(n)}
                className={`flex-1 h-8 rounded text-xs font-medium transition-colors ${
                  currentCount === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-weeks-${n}`}
              >
                {n} weken
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
