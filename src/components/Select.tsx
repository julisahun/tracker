import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | SelectOption>;
  placeholder?: string;
  /** Show a "clear" entry that sets the value back to "". */
  allowEmpty?: boolean;
  className?: string;
}

function normalize(opt: string | SelectOption): SelectOption {
  return typeof opt === "string" ? { value: opt } : opt;
}

/** Custom dropdown (replaces the OS-default <select>). Renders its menu in a
 *  portal so it isn't clipped by scrolling containers or modals. */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  allowEmpty = false,
  className = "",
}: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const opts = options.map(normalize);
  const current = opts.find((o) => o.value === value);

  const openMenu = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-2.5 py-1 text-sm outline-none transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
      >
        <span className={current ? "truncate" : "truncate text-muted"}>
          {current?.label ?? current?.value ?? placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open &&
        rect &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onMouseDown={() => setOpen(false)}
            />
            <div
              className="fixed z-[60] max-h-60 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-xl"
              style={{
                top: rect.bottom + 4,
                left: rect.left,
                minWidth: rect.width,
              }}
            >
              {allowEmpty && (
                <Option
                  label={placeholder}
                  muted
                  selected={value === ""}
                  onClick={() => pick("")}
                />
              )}
              {opts.map((o) => (
                <Option
                  key={o.value}
                  label={o.label ?? o.value}
                  selected={o.value === value}
                  onClick={() => pick(o.value)}
                />
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function Option({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-raised ${
        selected ? "font-medium text-accent-soft-fg" : muted ? "text-muted" : ""
      }`}
    >
      <span className="truncate">{label}</span>
      {selected && <Check size={14} className="shrink-0 text-accent" />}
    </button>
  );
}
