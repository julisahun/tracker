import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { X } from "lucide-react";

type DialogKind = "confirm" | "prompt";

interface DialogRequest {
  kind: DialogKind;
  title: string;
  message?: string;
  /** prompt only */
  placeholder?: string;
  defaultValue?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** styles the confirm button as destructive */
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

interface DialogState {
  current: DialogRequest | null;
  open: (req: DialogRequest) => void;
  close: () => void;
}

const useDialogStore = create<DialogState>((set) => ({
  current: null,
  open: (req) => set({ current: req }),
  close: () => set({ current: null }),
}));

/**
 * Drop-in async replacement for `window.confirm`.
 * Resolves `true` if confirmed, `false` otherwise.
 */
export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({
      kind: "confirm",
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? "Confirm",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      danger: opts.danger,
      resolve: (v) => resolve(v === true),
    });
  });
}

/**
 * Drop-in async replacement for `window.prompt`.
 * Resolves the entered string, or `null` if cancelled.
 */
export function promptDialog(opts: {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({
      kind: "prompt",
      title: opts.title,
      message: opts.message,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue,
      confirmLabel: opts.confirmLabel ?? "OK",
      cancelLabel: opts.cancelLabel ?? "Cancel",
      resolve: (v) => resolve(typeof v === "string" ? v : null),
    });
  });
}

const inputClass =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30";

/** Mount once near the app root. Renders the active dialog, if any. */
export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset/focus the input whenever a new prompt opens.
  useEffect(() => {
    if (current?.kind === "prompt") {
      setValue(current.defaultValue ?? "");
      // focus after the modal paints
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [current]);

  if (!current) return null;

  const settle = (result: string | boolean | null) => {
    current.resolve(result);
    close();
  };

  const cancel = () => settle(current.kind === "prompt" ? null : false);

  const confirm = () => {
    if (current.kind === "prompt") {
      const trimmed = value.trim();
      if (!trimmed) return; // require a value
      settle(trimmed);
    } else {
      settle(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={cancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{current.title}</h2>
          <button
            onClick={cancel}
            className="-mr-1 -mt-0.5 rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {current.message && (
            <p className="text-sm text-muted">{current.message}</p>
          )}
          {current.kind === "prompt" && (
            <input
              ref={inputRef}
              className={`${inputClass} ${current.message ? "mt-3" : ""}`}
              value={value}
              placeholder={current.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={cancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            {current.cancelLabel}
          </button>
          <button
            onClick={confirm}
            className={
              current.danger
                ? "rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger/90"
                : "rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            }
          >
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
