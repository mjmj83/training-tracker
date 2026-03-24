import { useState, useEffect } from "react";

// Simple global state for selected client and month
let _selectedClientId: number | null = null;
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
