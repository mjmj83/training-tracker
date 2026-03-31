import { useState, useRef, useCallback, Fragment, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, ChevronDown, ChevronRight, Settings, ArrowUp, ArrowDown, Lock, Unlock, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  onMoveDayUp?: () => void;
  onMoveDayDown?: () => void;
  canMoveDayUp?: boolean;
  canMoveDayDown?: boolean;
  hideHeader?: boolean;
  defaultCollapsed?: boolean;
}

export default function TrainingDaySection({ day, exercises, weekDates, monthId, weekCount, onBeforeChange, readOnly = false, onMoveDayUp, onMoveDayDown, canMoveDayUp = false, canMoveDayDown = false, hideHeader = false, defaultCollapsed = false }: Props) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(day.name);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragSourceId = useRef<number | null>(null);
  const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // Compute locked weeks from weekDates
  const lockedWeeks = useMemo(() => {
    const set = new Set<number>();
    for (const wd of weekDates) {
      if (wd.trainingDayId === day.id && wd.locked) set.add(wd.weekNumber);
    }
    return set;
  }, [weekDates, day.id]);

  const toggleLock = useMutation({
    mutationFn: (data: { weekNumber: number; locked: boolean }) =>
      apiRequest("POST", "/api/week-dates/toggle-lock", {
        monthId, trainingDayId: day.id, weekNumber: data.weekNumber, locked: data.locked,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
    },
  });

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

  const moveExercise = useCallback(async (exerciseId: number, direction: 'up' | 'down') => {
    const idx = sortedExercises.findIndex(e => e.id === exerciseId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedExercises.length) return;

    const current = sortedExercises[idx];
    const swap = sortedExercises[swapIdx];

    onBeforeChange();
    await apiRequest("PATCH", `/api/exercises/${current.id}`, { sortOrder: swap.sortOrder });
    await apiRequest("PATCH", `/api/exercises/${swap.id}`, { sortOrder: current.sortOrder });
    queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
  }, [sortedExercises, monthId, onBeforeChange]);

  const swapSupersetOrder = useCallback(async (exerciseId: number) => {
    const ex = sortedExercises.find(e => e.id === exerciseId);
    if (!ex || !ex.supersetGroupId) return;
    // Find superset neighbors
    const supersetMembers = sortedExercises.filter(e => e.supersetGroupId === ex.supersetGroupId);
    if (supersetMembers.length < 2) return;
    const idx = supersetMembers.findIndex(e => e.id === exerciseId);
    const swapIdx = idx === 0 ? 1 : idx - 1;
    const current = supersetMembers[idx];
    const swap = supersetMembers[swapIdx];

    onBeforeChange();
    await apiRequest("PATCH", `/api/exercises/${current.id}`, { sortOrder: swap.sortOrder });
    await apiRequest("PATCH", `/api/exercises/${swap.id}`, { sortOrder: current.sortOrder });
    queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
  }, [sortedExercises, monthId, onBeforeChange]);

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

  // Build labels for superset groups: Superset A, Superset B, etc.
  const groupLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    let letterIdx = 0;
    for (const g of groups) {
      if (g.groupId !== null && g.exercises.length > 1) {
        const letter = String.fromCharCode(65 + letterIdx);
        const size = g.exercises.length;
        const prefix = size === 2 ? "Superset" : size === 3 ? "Triset" : "Giant set";
        map.set(g.groupId, `${prefix} ${letter}`);
        letterIdx++;
      }
    }
    return map;
  }, [groups]);

  const getGroupLabel = (groupId: number | null, exerciseCount: number) => {
    if (groupId !== null && groupLabelMap.has(groupId)) return groupLabelMap.get(groupId)!;
    if (exerciseCount === 2) return "Superset";
    if (exerciseCount === 3) return "Triset";
    if (exerciseCount >= 4) return "Giant set";
    return "";
  };

  // Move an entire group (superset/triset/giant set) up or down
  const moveGroup = useCallback(async (groupIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? groupIdx - 1 : groupIdx + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    onBeforeChange();
    const currentGroup = groups[groupIdx];
    const targetGroup = groups[targetIdx];

    // Collect all sortOrders and reassign
    const allExercises = [...currentGroup.exercises, ...targetGroup.exercises];
    const allSortOrders = allExercises.map(e => e.sortOrder).sort((a, b) => a - b);

    const reordered = direction === 'up'
      ? [...currentGroup.exercises, ...targetGroup.exercises]
      : [...targetGroup.exercises, ...currentGroup.exercises];

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sortOrder !== allSortOrders[i]) {
        await apiRequest("PATCH", `/api/exercises/${reordered[i].id}`, { sortOrder: allSortOrders[i] });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
  }, [groups, monthId, onBeforeChange]);

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
      // If target is already in a superset, add source to that group
      const targetEx = sortedExercises.find(e => e.id === targetExerciseId);
      if (targetEx?.supersetGroupId) {
        const groupMembers = sortedExercises
          .filter(e => e.supersetGroupId === targetEx.supersetGroupId)
          .map(e => e.id);
        if (!groupMembers.includes(sourceId)) {
          createSuperset.mutate([...groupMembers, sourceId]);
        }
      } else {
        // If source is already in a superset, add target to that group
        const sourceEx = sortedExercises.find(e => e.id === sourceId);
        if (sourceEx?.supersetGroupId) {
          const groupMembers = sortedExercises
            .filter(e => e.supersetGroupId === sourceEx.supersetGroupId)
            .map(e => e.id);
          if (!groupMembers.includes(targetExerciseId)) {
            createSuperset.mutate([...groupMembers, targetExerciseId]);
          }
        } else {
          createSuperset.mutate([sourceId, targetExerciseId]);
        }
      }
    }
    dragSourceId.current = null;
    setDragOverId(null);
  };

  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  return (
    <div className="mb-4" data-testid={`training-day-${day.id}`}>
      {/* Day Header / Ruler */}
      {!hideHeader && (
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-2 mb-1 sticky top-0 z-20">
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
        <button
          onClick={() => window.open(`/#/train/${monthId}/${day.id}`, "_blank", "width=420,height=750")}
          className="p-1 text-primary/70 hover:text-primary transition-colors"
          title="Train Now"
          data-testid={`button-train-now-list-${day.id}`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" data-testid={`button-day-menu-${day.id}`}>
                <Settings className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canMoveDayUp && onMoveDayUp && (
                <DropdownMenuItem onClick={onMoveDayUp}>
                  <ArrowUp className="w-4 h-4 mr-2" /> Omhoog verplaatsen
                </DropdownMenuItem>
              )}
              {canMoveDayDown && onMoveDayDown && (
                <DropdownMenuItem onClick={onMoveDayDown}>
                  <ArrowDown className="w-4 h-4 mr-2" /> Omlaag verplaatsen
                </DropdownMenuItem>
              )}
              {(canMoveDayUp || canMoveDayDown) && <DropdownMenuSeparator />}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteDayConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      )}

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
        <div className="overflow-x-auto">
          <table className="text-sm border-separate w-full" style={{ borderSpacing: '0 0' }} data-testid={`table-exercises-${day.id}`}>
            <tbody>
              {/* Week headers row — combined with first group label */}
              <tr>
                <td className="text-left py-1.5 px-2 align-bottom sticky left-0 z-10 bg-background">
                  {/* Show first group label if the first group is grouped */}
                  {groups.length > 0 && groups[0].groupId !== null && groups[0].exercises.length > 1 ? (
                    <div>
                      {!readOnly && groups.length > 1 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-[10px] italic text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer">
                              {getGroupLabel(groups[0].groupId, groups[0].exercises.length)}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {groups.length > 1 && (
                              <DropdownMenuItem onClick={() => moveGroup(0, 'down')}>
                                <ArrowDown className="w-3.5 h-3.5 mr-2" /> Omlaag verplaatsen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[10px] italic text-muted-foreground/60">
                          {getGroupLabel(groups[0].groupId, groups[0].exercises.length)}
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                {weeks.map((w) => {
                  const isLocked = lockedWeeks.has(w);
                  return (
                    <td
                      key={w}
                      className={`text-center py-1.5 px-1 font-medium text-muted-foreground w-[110px] max-w-[110px] text-xs align-bottom transition-colors group/weekhdr ${hoveredWeek === w ? "bg-primary/10" : ""}`}
                      onMouseEnter={() => setHoveredWeek(w)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <span>Week {w}</span>
                          {!readOnly && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => toggleLock.mutate({ weekNumber: w, locked: !isLocked })}
                                  className={`transition-opacity ${
                                    isLocked
                                      ? "text-primary opacity-100"
                                      : "text-muted-foreground/30 opacity-0 group-hover/weekhdr:opacity-100 hover:text-muted-foreground"
                                  }`}
                                  data-testid={`button-lock-w${w}-day${day.id}`}
                                >
                                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {isLocked ? "Week ontgrendelen" : "Week vergrendelen"}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <WeekDateInput
                          monthId={monthId}
                          trainingDayId={day.id}
                          weekNumber={w}
                          weekDates={weekDates}
                          readOnly={readOnly || isLocked}
                        />
                      </div>
                    </td>
                  );
                })}
                {!readOnly && <td className="w-8"></td>}
                <td className="w-0 p-0 border-0"></td>
              </tr>

              {groups.map((group, gi) => {
                const isGrouped = group.groupId !== null && group.exercises.length > 1;
                const groupSize = group.exercises.length;
                const groupLabel = getGroupLabel(group.groupId, groupSize);
                return group.exercises.map((ex, ei) => {
                  // Determine global index in sortedExercises for move up/down
                  const globalIdx = sortedExercises.findIndex(e => e.id === ex.id);
                  const isFirstOverall = gi === 0 && ei === 0;
                  // Skip the group label for the very first group (already in header row)
                  const showGroupLabel = isGrouped && ei === 0 && gi > 0;

                  return (
                    <Fragment key={ex.id}>
                      {/* Spacer between groups */}
                      {!isFirstOverall && ei === 0 && (
                        <tr><td colSpan={999} className="h-4 p-0 border-0"></td></tr>
                      )}
                      {isGrouped && ei > 0 && (
                        <tr><td colSpan={999} className="h-1 p-0 border-0"></td></tr>
                      )}
                      {/* Group label for 2nd+ groups */}
                      {showGroupLabel && (
                        <tr><td colSpan={999} className="p-0 border-0" style={{ lineHeight: '16px' }}>
                          {!readOnly && groups.length > 1 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-[10px] italic text-muted-foreground/60 pl-2 hover:text-muted-foreground transition-colors cursor-pointer">
                                  {groupLabel}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {gi > 0 && (
                                  <DropdownMenuItem onClick={() => moveGroup(gi, 'up')}>
                                    <ArrowUp className="w-3.5 h-3.5 mr-2" /> Omhoog verplaatsen
                                  </DropdownMenuItem>
                                )}
                                {gi < groups.length - 1 && (
                                  <DropdownMenuItem onClick={() => moveGroup(gi, 'down')}>
                                    <ArrowDown className="w-3.5 h-3.5 mr-2" /> Omlaag verplaatsen
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground/60 pl-2">{groupLabel}</span>
                          )}
                        </td></tr>
                      )}
                      <ExerciseRow
                        exercise={ex}
                        weightLogs={ex.weightLogs}
                        monthId={monthId}
                        weekCount={weekCount}
                        isSuperset={isGrouped}
                        isFirstInSuperset={isGrouped && ei === 0}
                        isLastInSuperset={isGrouped && ei === group.exercises.length - 1}
                        isDragOver={dragOverId === ex.id}
                        onDragStart={() => handleDragStart(ex.id)}
                        onDragOver={(e) => handleDragOver(e, ex.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(ex.id)}
                        onBeforeChange={onBeforeChange}
                        hoveredWeek={hoveredWeek}
                        onWeekHover={setHoveredWeek}
                        readOnly={readOnly}
                        lockedWeeks={lockedWeeks}
                        onMoveUp={() => moveExercise(ex.id, 'up')}
                        onMoveDown={() => moveExercise(ex.id, 'down')}
                        canMoveUp={globalIdx > 0}
                        canMoveDown={globalIdx < sortedExercises.length - 1}
                        onSwapSupersetOrder={isGrouped ? () => swapSupersetOrder(ex.id) : undefined}
                      />
                    </Fragment>
                  );
                });
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
