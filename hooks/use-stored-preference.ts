"use client";

import { useState, useSyncExternalStore } from "react";

export const BOOLEAN_PREFERENCES = ["true", "false"] as const;

// Snapshots are primitives so React can compare them without repeated renders.
// Writes still update this mounted control when browser storage is blocked.
export function createPreferenceStore<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  let value = fallback;
  let memoryOnly = false;
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    if (!memoryOnly) {
      try {
        const saved = window.localStorage.getItem(key);
        value = saved !== null && allowed.includes(saved as T) ? saved as T : fallback;
      } catch { /* Use the in-memory preference. */ }
    }
    return value;
  };
  return {
    getSnapshot,
    getServerSnapshot: () => fallback,
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          memoryOnly = false;
          listener();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
    },
    setValue(next: T) {
      if (!allowed.includes(next)) return;
      value = next;
      try { window.localStorage.setItem(key, next); memoryOnly = false; }
      catch { memoryOnly = true; }
      listeners.forEach(listener => listener());
    },
  };
}

// Callers keep the storage key and allowed values fixed for this mounted control.
export function useStoredPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [store] = useState(() => createPreferenceStore(key, fallback, allowed));
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [value, store.setValue] as const;
}
