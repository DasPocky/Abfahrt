import type { ReactNode } from "react";
import { cn } from "cn";

/** Gemeinsame Optik für Filter-Chips (Abfahrten, Verbindungsoptionen) */
export const CHIP_BASE =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
export const CHIP_ON = "bg-foreground text-background";
export const CHIP_OFF = "bg-muted text-foreground hover:bg-accent";

export function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
    >
      {children}
    </button>
  );
}
