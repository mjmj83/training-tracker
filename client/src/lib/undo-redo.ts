import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;
  undoCount: number;
  redoCount: number;
}

const MAX_HISTORY = 25;

// Store snapshots as JSON strings of the full month data
let _undoStack: string[] = [];
let _redoStack: string[] = [];
let _listeners: Set<() => void> = new Set();

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

export function useUndoRedo(monthId: number | null): UndoRedoState {
  const [, forceUpdate] = useState(0);
  const prevMonthId = useRef<number | null>(null);

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  // Reset stacks when month changes
  useEffect(() => {
    if (monthId !== prevMonthId.current) {
      _undoStack = [];
      _redoStack = [];
      prevMonthId.current = monthId;
      notifyListeners();
    }
  }, [monthId]);

  const pushSnapshot = useCallback(async () => {
    if (!monthId) return;
    try {
      const res = await apiRequest("GET", `/api/months/${monthId}/full`);
      const data = await res.json();
      const json = JSON.stringify(data);
      _undoStack.push(json);
      if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
      _redoStack = [];
      notifyListeners();
    } catch {}
  }, [monthId]);

  const undo = useCallback(async () => {
    if (!monthId || _undoStack.length === 0) return;
    // Save current state to redo stack first
    try {
      const res = await apiRequest("GET", `/api/months/${monthId}/full`);
      const currentData = await res.json();
      _redoStack.push(JSON.stringify(currentData));
      if (_redoStack.length > MAX_HISTORY) _redoStack.shift();
    } catch {}

    const prevState = _undoStack.pop()!;
    const data = JSON.parse(prevState);

    // Restore via API
    try {
      // Create a temp snapshot, restore, then delete
      const saveRes = await apiRequest("POST", `/api/months/${monthId}/save`);
      const snap = await saveRes.json();

      // Now we need to restore from the undo data directly
      // We'll use a direct restore endpoint
      await apiRequest("POST", `/api/months/${monthId}/restore-data`, data);

      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } catch {}
    notifyListeners();
  }, [monthId]);

  const redo = useCallback(async () => {
    if (!monthId || _redoStack.length === 0) return;
    // Save current state to undo stack
    try {
      const res = await apiRequest("GET", `/api/months/${monthId}/full`);
      const currentData = await res.json();
      _undoStack.push(JSON.stringify(currentData));
      if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    } catch {}

    const nextState = _redoStack.pop()!;
    const data = JSON.parse(nextState);

    try {
      await apiRequest("POST", `/api/months/${monthId}/restore-data`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/months", monthId, "full"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } catch {}
    notifyListeners();
  }, [monthId]);

  return {
    canUndo: _undoStack.length > 0,
    canRedo: _redoStack.length > 0,
    undo,
    redo,
    pushSnapshot,
    undoCount: _undoStack.length,
    redoCount: _redoStack.length,
  };
}
