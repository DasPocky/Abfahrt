import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { lineBadgeColors } from "@/lib/line-colors";
import type { Departure } from "../../shared/api-types";

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
        // Lange Bezeichnungen (z. B. „ICE 1023“) brechen um statt zu überlaufen; der Ring hält
        // helle Linienfarben auf hellem Grund sichtbar
        "h-auto min-h-7 max-w-full min-w-12 rounded-md px-1.5 text-center text-sm leading-tight font-bold break-words whitespace-normal tabular-nums ring-1 ring-black/10 ring-inset dark:ring-white/15",
        colors.className,
        className,
      )}
      style={colors.style}
    >
      {departure.line}
    </Badge>
  );
}
