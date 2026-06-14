import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "../theme";

const OPTIONS: Array<{ value: Theme; Icon: typeof Sun; label: string }> = [
  { value: "light", Icon: Sun, label: "Light" },
  { value: "system", Icon: Monitor, label: "System" },
  { value: "dark", Icon: Moon, label: "Dark" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-raised/60 p-0.5">
      {OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          title={label}
          onClick={() => setTheme(value)}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            theme === value
              ? "bg-surface text-fg shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
