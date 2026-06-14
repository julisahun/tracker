import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "tracker:theme";
const mq = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getStoredTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme | null) ?? "system";
}

function resolveDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && mq().matches);
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

/** Theme state synced to localStorage, the `.dark` class, and OS changes. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const media = mq();
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  };

  return [theme, setTheme];
}
