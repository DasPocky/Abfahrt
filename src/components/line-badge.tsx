import { cn } from "cn";
import { ModeIcon } from "@/components/mode-icon";
import { Badge } from "@/components/ui/badge";
import { lineBadgeColors } from "@/lib/line-colors";
import { MODE_LABEL } from "@/lib/modes";
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
        "h-6 w-[4.25rem] shrink-0 justify-start gap-1 overflow-hidden rounded-md px-1.5 text-[0.8rem] font-bold tabular-nums ring-1 ring-black/10 ring-inset dark:ring-white/15",
        colors.className,
        className,
      )}
      style={colors.style}
    >
      {/* Lange Bezeichnungen (z. B. „ICE 1023“) brauchen den Platz, dann ohne Symbol */}
      {departure.line.length <= 4 ? (
        <ModeIcon mode={departure.mode} className="size-3.5! shrink-0 opacity-90" />
      ) : (
        <span className="sr-only">{MODE_LABEL[departure.mode]} </span>
      )}
      <span className="truncate">{departure.line}</span>
    </Badge>
  );
}
