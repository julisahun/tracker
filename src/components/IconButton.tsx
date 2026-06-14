import type { ReactNode, MouseEvent } from "react";

interface IconButtonProps {
  title: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  danger?: boolean;
  className?: string;
}

/** A compact, ghost-style icon button used throughout the chrome. */
export function IconButton({
  title,
  onClick,
  children,
  danger,
  className = "",
}: IconButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-fg ${
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-raised"
      } ${className}`}
    >
      {children}
    </button>
  );
}
