import { useEffect, useState } from "react";

// recharts needs concrete color strings, but the app themes via CSS variables
// (see index.css). This hook reads the resolved values and re-reads whenever the
// `.dark` class on <html> changes (theme.ts toggles it for light/dark/system).

export interface ThemeColors {
  fg: string;
  muted: string;
  line: string;
  accent: string;
  surface: string;
  /** A palette for multi-bucket charts, anchored on the accent. */
  series: string[];
}

function readColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const v = (name: string) => styles.getPropertyValue(name).trim();
  const accent = v("--accent") || "#4f46e5";
  return {
    fg: v("--fg") || "#1a1d24",
    muted: v("--muted") || "#6b7280",
    line: v("--line") || "#e5e7eb",
    surface: v("--surface") || "#ffffff",
    accent,
    series: [accent, "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"],
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(readColors);

  useEffect(() => {
    const update = () => setColors(readColors());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
