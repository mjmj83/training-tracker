import { useState, useEffect } from "react";

// --- Persistent storage (localStorage with in-memory fallback) ---
function canUseLocalStorage(): boolean {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}
const useLS = canUseLocalStorage();

function loadState(key: string): string | null {
  if (useLS) return localStorage.getItem(key);
  return null;
}
function saveState(key: string, value: string | null) {
  if (!useLS) return;
  if (value !== null) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

// --- Global state with persistence ---
let _selectedClientId: number | null = (() => {
  const v = loadState("tt_client");
  return v ? parseInt(v) : null;
})();
let _selectedMonthId: number | null = null;
const _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function useSelectedClient() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);
  return {
    clientId: _selectedClientId,
    setClientId: (id: number | null) => {
      _selectedClientId = id;
      _selectedMonthId = null;
      saveState("tt_client", id !== null ? String(id) : null);
      notify();
    },
  };
}

export function useSelectedMonth() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);
  return {
    monthId: _selectedMonthId,
    setMonthId: (id: number | null) => {
      _selectedMonthId = id;
      notify();
    },
  };
}

// --- View mode persistence ---
export function getViewMode(): "list" | "tabs" {
  return (loadState("tt_view_mode") as "list" | "tabs") || "list";
}
export function saveViewMode(mode: "list" | "tabs") {
  saveState("tt_view_mode", mode);
}
