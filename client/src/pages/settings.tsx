import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ExerciseLibrary } from "@shared/schema";

export default function SettingsPage() {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  const { data: exercises = [] } = useQuery<ExerciseLibrary[]>({
    queryKey: ["/api/exercise-library/all"],
    queryFn: () => apiRequest("GET", "/api/exercise-library/all").then(r => r.json()),
  });

  const addExercise = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/exercise-library", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library/all"] });
      setNewName("");
    },
  });

  const toggleActive = useMutation({
    mutationFn: (data: { id: number; active: boolean }) =>
      apiRequest("PATCH", `/api/exercise-library/${data.id}`, { active: data.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library"] });
    },
  });

  const filtered = exercises
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Active first, then alphabetical
      if (a.active !== b.active) return b.active - a.active;
      return a.name.localeCompare(b.name);
    });

  const activeCount = exercises.filter(e => e.active).length;
  const inactiveCount = exercises.filter(e => !e.active).length;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold mb-1" data-testid="text-settings-title">Instellingen</h1>
      <p className="text-sm text-muted-foreground mb-6">Beheer de lijst met beschikbare oefeningen.</p>

      {/* Add exercise */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nieuwe oefening toevoegen..."
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) addExercise.mutate(newName.trim());
          }}
          data-testid="input-new-library-exercise"
        />
        <Button
          onClick={() => newName.trim() && addExercise.mutate(newName.trim())}
          disabled={!newName.trim()}
          className="gap-1"
          data-testid="button-add-library-exercise"
        >
          <Plus className="w-4 h-4" />
          Toevoegen
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek oefening..."
          className="pl-9 text-sm"
          data-testid="input-search-library"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
        <span>{activeCount} actief</span>
        <span>{inactiveCount} inactief</span>
        <span>{exercises.length} totaal</span>
      </div>

      {/* Exercise list */}
      <div className="border border-border rounded-md divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {search ? "Geen oefeningen gevonden" : "Nog geen oefeningen in de database"}
          </div>
        ) : (
          filtered.map((ex) => (
            <div
              key={ex.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${!ex.active ? "opacity-50" : ""}`}
              data-testid={`library-exercise-${ex.id}`}
            >
              <span className={`flex-1 text-sm ${!ex.active ? "line-through" : ""}`}>
                {ex.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${ex.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {ex.active ? "actief" : "inactief"}
              </span>
              <Switch
                checked={!!ex.active}
                onCheckedChange={(checked) => toggleActive.mutate({ id: ex.id, active: checked })}
                data-testid={`toggle-exercise-${ex.id}`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
