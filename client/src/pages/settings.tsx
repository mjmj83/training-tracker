import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Search, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ExerciseLibrary } from "@shared/schema";

export default function SettingsPage() {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

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

  const toggleWeightType = useMutation({
    mutationFn: (data: { id: number; weightType: string }) =>
      apiRequest("PATCH", `/api/exercise-library/${data.id}`, { weightType: data.weightType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library"] });
    },
  });

  const renameExercise = useMutation({
    mutationFn: (data: { id: number; oldName: string; name: string }) =>
      apiRequest("PATCH", `/api/exercise-library/${data.id}`, { oldName: data.oldName, name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-library"] });
      setEditingId(null);
    },
  });

  const filtered = exercises
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.active !== b.active) return b.active - a.active;
      return a.name.localeCompare(b.name);
    });

  const activeCount = exercises.filter(e => e.active).length;
  const inactiveCount = exercises.filter(e => !e.active).length;

  const handleRename = (ex: ExerciseLibrary) => {
    if (editingName.trim() && editingName.trim() !== ex.name) {
      renameExercise.mutate({ id: ex.id, oldName: ex.name, name: editingName.trim() });
    } else {
      setEditingId(null);
    }
  };

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
          className="gap-1 shrink-0"
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
              className={`flex items-center gap-3 px-4 py-2.5 group ${!ex.active ? "opacity-50" : ""}`}
              data-testid={`library-exercise-${ex.id}`}
            >
              {editingId === ex.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(ex);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename(ex)}
                    className="h-8 text-sm"
                    autoFocus
                    data-testid={`input-rename-${ex.id}`}
                  />
                </div>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${!ex.active ? "line-through" : ""}`}>
                    {ex.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(ex.id);
                      setEditingName(ex.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity p-0.5"
                    data-testid={`button-rename-${ex.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => toggleWeightType.mutate({
                  id: ex.id,
                  weightType: (ex.weightType ?? "weighted") === "weighted" ? "reps_only" : "weighted",
                })}
                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 cursor-pointer transition-colors ${
                  (ex.weightType ?? "weighted") === "reps_only"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`toggle-library-weight-type-${ex.id}`}
              >
                {(ex.weightType ?? "weighted") === "reps_only" ? "reps" : "kg"}
              </button>
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${ex.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
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
