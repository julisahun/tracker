import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** Custom checkbox styled with the theme tokens (replaces the OS default). */
export function Checkbox({ checked, onChange, className = "" }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        checked
          ? "border-accent bg-accent text-accent-fg"
          : "border-line bg-bg hover:border-accent/60"
      } ${className}`}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}
