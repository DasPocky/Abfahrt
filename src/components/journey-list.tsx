import { useId, useState } from "react";
import { ChevronDown, Footprints } from "lucide-react";
import { cn } from "cn";
import { LineBadge } from "@/components/line-badge";
import {
  formatDuration,
  formatTransfers,
  isJourneyCancelled,
  isLegCancelled,
  journeyTimes,
} from "@/lib/journeys";
import { platformLabel } from "@/lib/modes";
import { DELAY_TONE_CLASS, delayMinutes, delayTone, formatClock, formatDelay } from "@/lib/time";
import type { Journey, JourneyLeg, JourneyStop, TransportMode } from "../../shared/api-types";

/** Uhrzeit laut Plan, dahinter die Verspätung in den Farben der Abfahrtsliste */
function Clock({
  planned,
  realtime,
  cancelled = false,
}: {
  planned: string | null;
  realtime: string | null;
  cancelled?: boolean;
}) {
  if (planned === null) return <span>–</span>;
  const delay = delayMinutes(planned, realtime);
  const tone = delayTone(delay);
  return (
    <span className="whitespace-nowrap">
      <time dateTime={planned} className={cn(cancelled && "line-through")}>
        {formatClock(new Date(planned))}
      </time>
      {delay !== null && delay !== 0 && !cancelled && (
        <span
          className={cn("ml-0.5 text-[0.7em] font-semibold", DELAY_TONE_CLASS[tone])}
          data-tone={tone}
        >
          {formatDelay(delay)}
        </span>
      )}
    </span>
  );
}

function legBadge(leg: JourneyLeg) {
  return {
    line: leg.line ?? "?",
    mode: leg.mode ?? ("other" satisfies TransportMode),
    lineColor: leg.lineColor,
    lineTextColor: leg.lineTextColor,
  };
}

function walkText(leg: JourneyLeg): string {
  const parts = [`Fußweg ${formatDuration(leg.durationMinutes)}`];
  if (leg.distanceMeters !== null) parts.push(`${Math.round(leg.distanceMeters)} m`);
  return parts.join(" · ");
}

/** Halt eines Abschnitts: Zeit, Name, Gleis/Steig */
function LegStop({
  stop,
  mode,
  time,
}: {
  stop: JourneyStop;
  mode: TransportMode;
  time: "departure" | "arrival";
}) {
  const planned = time === "departure" ? stop.plannedDeparture : stop.plannedArrival;
  const realtime = time === "departure" ? stop.realtimeDeparture : stop.realtimeArrival;
  const changed =
    stop.platform !== null &&
    stop.plannedPlatform !== null &&
    stop.platform !== stop.plannedPlatform;
  return (
    <p className="flex gap-1.5">
      <span className="w-12 shrink-0 tabular-nums">
        <Clock planned={planned} realtime={realtime} cancelled={stop.cancelled} />
      </span>
      <span className={cn("min-w-0 flex-1", stop.cancelled && "line-through")}>
        {stop.name}
        {stop.platform !== null && (
          <span className={cn("text-muted-foreground", changed && "font-semibold text-warning")}>
            {" · "}
            {platformLabel(mode)} {stop.platform}
            {changed && ` statt ${stop.plannedPlatform}`}
          </span>
        )}
      </span>
    </p>
  );
}

/** Abschnitte schlicht untereinander (ausführliche Ansicht folgt in #51) */
function LegList({ id, journey }: { id: string; journey: Journey }) {
  return (
    <ol id={id} aria-label="Abschnitte" className="space-y-1.5 border-t px-3 py-2 text-xs">
      {journey.legs.map((leg, index) =>
        leg.kind === "walk" ? (
          <li key={index} className="flex items-center gap-1.5 text-muted-foreground">
            <Footprints className="size-3.5 shrink-0" aria-hidden="true" />
            {walkText(leg)}
          </li>
        ) : (
          <li key={index} className="flex items-start gap-2">
            <LineBadge departure={legBadge(leg)} className="h-5 w-auto max-w-20 text-[0.7rem]" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <LegStop stop={leg.origin} mode={leg.mode ?? "other"} time="departure" />
              {leg.direction && (
                <p className="pl-[3.375rem] text-muted-foreground">Richtung {leg.direction}</p>
              )}
              <LegStop stop={leg.destination} mode={leg.mode ?? "other"} time="arrival" />
              {isLegCancelled(leg) && (
                <p className="pl-[3.375rem] font-semibold text-destructive">Fahrt fällt aus</p>
              )}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

function JourneyRow({ journey }: { journey: Journey }) {
  const [expanded, setExpanded] = useState(false);
  const legsId = useId();
  const times = journeyTimes(journey);
  const cancelled = isJourneyCancelled(journey);

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
        </span>
      </button>
      {expanded && <LegList id={legsId} journey={journey} />}
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
