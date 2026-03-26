import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSelectedClient } from "@/lib/state";
import { Plus } from "lucide-react";
import type { ExerciseLibrary } from "@shared/schema";

interface Props {
  trainingDayId: number;
  monthId: number;
  sortOrder: number;
  onBeforeChange?: () => void;
}

export default function AddExerciseRow({ trainingDayId, monthId, sortOrder, onBeforeChange }: Props) {
  const { clientId } = useSelectedClient();
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = useQuery<ExerciseLibrary[]>({
    queryKey: ["/api/exercise-library", searchQuery],
    queryFn: () =>
      apiRequest("GET", `/api/exercise-library?q=${encodeURIComponent(searchQuery)}`).then((r) =>
        r.json()
      ),
    enabled: searchQuery.length > 0,
  });

  const createExercise = useMutation({
    mutationFn: async (name: string) => {
      // Try to fetch last-used config for this exercise name
      let config: { sets: number; goalReps: number; tempo: string; rest: number; rir: string } | null = null;
      if (clientId) {
        try {
          const res = await apiRequest("GET", `/api/clients/${clientId}/exercise-config/${encodeURIComponent(name)}`);
          config = await res.json();
        } catch {
          // Ignore — use defaults
        }
      }
      return apiRequest("POST", "/api/exercises", {
        trainingDayId,
        name,
        sets: config?.sets ?? 3,
        goalReps: config?.goalReps ?? 10,
        tempo: config?.tempo ?? "",
        rest: config?.rest ?? 60,
        rir: config?.rir ?? "",
        sortOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      setSearchQuery("");
      setIsAdding(false);
    },
  });

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  const handleSubmit = (name?: string) => {
    const finalName = name ?? searchQuery.trim();
    if (finalName) {
      onBeforeChange?.();
      createExercise.mutate(finalName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && selectedIndex < suggestions.length) {
        handleSubmit(suggestions[selectedIndex].name);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setSearchQuery("");
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        data-testid={`button-add-exercise-${trainingDayId}`}
      >
        <Plus className="w-3 h-3" />
        <span>Oefening toevoegen</span>
      </button>
    );
  }

  return (
    <div className="relative px-2 py-1">
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Small delay to allow click on suggestion
          setTimeout(() => {
            setIsAdding(false);
            setSearchQuery("");
          }, 200);
        }}
        placeholder="Zoek of typ oefening... (bijv. 'bench', 'deadlift')"
        className="w-full bg-muted/50 border border-border rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
        data-testid={`input-search-exercise-${trainingDayId}`}
      />

      {/* Autocomplete dropdown */}
      {searchQuery.length > 0 && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-2 right-2 top-full mt-1 bg-popover border border-popover-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
          data-testid={`dropdown-suggestions-${trainingDayId}`}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${
                i === selectedIndex ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSubmit(s.name);
              }}
              data-testid={`suggestion-${s.id}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
