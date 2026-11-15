import { useId, useState } from "react";
import { ChevronDown, Footprints, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { Clock, JourneyDetails } from "@/components/journey-details";
import { LineBadge } from "@/components/line-badge";
import { journeyTransferRisk, legBadge, TRANSFER_RISK_TEXT, walkText } from "@/lib/connections";
import {
  formatDuration,
  formatTransfers,
  isJourneyCancelled,
  isLegCancelled,
  journeyTimes,
} from "@/lib/journeys";
import type { Journey } from "../../shared/api-types";

function JourneyRow({ journey }: { journey: Journey }) {
  const [expanded, setExpanded] = useState(false);
  const legsId = useId();
  const times = journeyTimes(journey);
  const cancelled = isJourneyCancelled(journey);
  const risk = cancelled ? null : journeyTransferRisk(journey);

  return (
    <li data-cancelled={cancelled || undefined}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={legsId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          cancelled && "border-l-4 border-l-destructive pl-2",
        )}
      >
        <span className={cn("font-semibold tabular-nums", cancelled && "text-muted-foreground")}>
          <Clock
            planned={times.plannedDeparture}
            realtime={times.realtimeDeparture}
            cancelled={cancelled}
          />
          <span aria-hidden="true"> – </span>
          <span className="sr-only"> bis </span>
          <Clock
            planned={times.plannedArrival}
            realtime={times.realtimeArrival}
            cancelled={cancelled}
          />
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          {formatDuration(journey.durationMinutes)}
          <span aria-hidden="true">·</span>
          <span className="sr-only">, </span>
          {formatTransfers(journey.transfers)}
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </span>
        <span className="col-span-2 flex flex-wrap items-center gap-1">
          {journey.legs.map((leg, index) =>
            leg.kind === "walk" ? (
              <Footprints
                key={index}
                className="size-3.5 text-muted-foreground"
                role="img"
                aria-label={walkText(leg)}
              />
            ) : (
              <LineBadge
                key={index}
                departure={legBadge(leg)}
                className={cn(
                  "h-5 w-auto max-w-20 text-[0.7rem]",
                  isLegCancelled(leg) && "line-through opacity-60",
                )}
              />
            ),
          )}
          {cancelled && (
            <span className="ml-auto text-xs font-semibold text-destructive">fällt aus</span>
          )}
          {risk && (
            <span
              className={cn(
                "ml-auto flex items-center gap-0.5 text-xs font-semibold",
                risk === "missed" ? "text-destructive" : "text-warning",
              )}
              data-transfer-risk={risk}
            >
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {TRANSFER_RISK_TEXT[risk]}
            </span>
          )}
        </span>
      </button>
      {expanded && <JourneyDetails id={legsId} journey={journey} />}
    </li>
  );
}

export function JourneyList({ journeys }: { journeys: readonly Journey[] }) {
  return (
    <ul aria-label="Verbindungen" className="divide-y">
      {journeys.map((journey) => (
        <JourneyRow key={journey.id} journey={journey} />
      ))}
    </ul>
  );
}
