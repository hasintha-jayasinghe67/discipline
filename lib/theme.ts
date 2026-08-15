"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

// Must match the key used by the inline script in app/layout.tsx.
export const THEME_STORAGE_KEY = "app-theme";

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // The inline script in the layout already set data-theme before first
  // paint; sync React state with it so the UI reflects the active theme.
  useEffect(() => {
    setTheme(getStoredTheme() ?? getSystemTheme());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
