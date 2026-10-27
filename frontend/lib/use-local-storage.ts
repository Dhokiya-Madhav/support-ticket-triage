"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // changes made in another tab
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * A string kept in localStorage. Server rendering and the first client render both see
 * `fallback`, so there is no hydration mismatch; the saved value is picked up right after.
 * If storage is blocked (private mode) it still works for the current page view.
 */
export function useLocalStorage(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );

  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, set];
}
