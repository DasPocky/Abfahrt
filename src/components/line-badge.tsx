import { cn } from "cn";
import { ModeIcon } from "@/components/mode-icon";
import { Badge } from "@/components/ui/badge";
import { lineBadgeColors } from "@/lib/line-colors";
import type { Departure } from "../../shared/api-types";

/** Linienfeld in Linienfarbe mit Verkehrsmittel-Symbol (Variante A, siehe #37) */
export function LineBadge({
  departure,
  className,
}: {
  departure: Pick<Departure, "line" | "mode" | "lineColor" | "lineTextColor">;
  className?: string;
}) {
  const colors = lineBadgeColors(departure);
  return (
    <Badge
      className={cn(
        // Der Ring hält helle Linienfarben auf hellem Grund sichtbar
        "h-7 w-[4.75rem] shrink-0 justify-start gap-1 overflow-hidden rounded-md px-1.5 text-sm font-bold tabular-nums ring-1 ring-black/10 ring-inset dark:ring-white/15",
        colors.className,
        className,
      )}
      style={colors.style}
    >
      <ModeIcon mode={departure.mode} className="size-3.5! shrink-0 opacity-90" />
      <span className="truncate">{departure.line}</span>
    </Badge>
  );
}
