import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  monthId: number;
  sortOrder: number;
  onBeforeChange?: () => void;
}

export default function AddTrainingDay({ monthId, sortOrder, onBeforeChange }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");

  const createDay = useMutation({
    mutationFn: (dayName: string) =>
      apiRequest("POST", "/api/training-days", {
        monthId,
        name: dayName,
        sortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setName("");
      setIsAdding(false);
    },
  });

  if (!isAdding) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="text-xs gap-1"
        data-testid="button-add-training-day"
      >
        <Plus className="w-3 h-3" />
        Trainingsdag toevoegen
      </Button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) { onBeforeChange?.(); createDay.mutate(name.trim()); }
          if (e.key === "Escape") { setIsAdding(false); setName(""); }
        }}
        placeholder="Bijv. 'Day 1 - Push'"
        className="h-8 text-xs max-w-xs"
        autoFocus
        data-testid="input-new-training-day"
      />
      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={() => { if (name.trim()) { onBeforeChange?.(); createDay.mutate(name.trim()); } }}
        data-testid="button-save-training-day"
      >
        Toevoegen
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs"
        onClick={() => { setIsAdding(false); setName(""); }}
      >
        Annuleren
      </Button>
    </div>
  );
}
