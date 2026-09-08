"use client";

import { useCallback, useEffect, useState } from "react";

export const FINDER_KEY = "finder-enabled";

export function getStoredFinder(): boolean {
  try {
    const stored = localStorage.getItem(FINDER_KEY);
    return stored === "1" || stored === "true";
  } catch {
    return false;
  }
}

export function applyFinder(enabled: boolean) {
  try {
    localStorage.setItem(FINDER_KEY, enabled ? "1" : "0");
  } catch {
    // Storage unavailable — preference still applies for this session.
  }
}

export function useFinder() {
  const [enabled, setEnabled] = useState(false);

  // Read persisted choice after first paint so the initial render doesn't
  // wrongly block the "/" key during SSR/client hydration.
  // Defaults to OFF so the "/" shortcut is opt-in.
  useEffect(() => {
    setEnabled(getStoredFinder());
  }, []);

  const setFinder = useCallback(
    (value: boolean) => {
      setEnabled((prev) => {
        const next =
          typeof value === "boolean" ? value : !prev;
        applyFinder(next);
        return next;
      });
    },
    [],
  );

  const toggleFinder = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      applyFinder(next);
      return next;
    });
  }, []);

  return { enabled, setFinder, toggleFinder };

  return { enabled, setFinder };
}
