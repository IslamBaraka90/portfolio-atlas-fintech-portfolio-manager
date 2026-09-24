import { useEffect, useState } from "react";

// Theme and density are per-viewer display conveniences. They never change a
// financial value, so browser storage is acceptable and every access tolerates
// blocked storage (private windows, cleared site data, test browsers).
export type ThemePreference = "system" | "light" | "dark";
const THEME_KEY = "portfolio-atlas.theme";

function readStored(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readStored);
  useEffect(() => {
    applyTheme(preference);
    try {
      if (preference === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, preference);
    } catch {
      // Storage is optional; the choice still applies for this page view.
    }
  }, [preference]);
  return [preference, setPreference] as const;
}
