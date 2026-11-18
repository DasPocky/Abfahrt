import { useId, useState } from "react";
import { ArrowRight, ChevronDown, Footprints, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { Clock, JourneyDetails } from "@/components/journey-details";
import { journeyTransferRisk, legBadge, TRANSFER_RISK_TEXT } from "@/lib/connections";
import {
  formatDuration,
  formatTransfers,
  isJourneyCancelled,
  isLegCancelled,
  journeyTimes,
} from "@/lib/journeys";
import { lineBadgeColors } from "@/lib/line-colors";
import { journeySignature } from "@/lib/saved-trip";
import { MODE_LABEL, platformLabel } from "@/lib/modes";
import { formatClock } from "@/lib/time";
import type { Journey, JourneyLeg } from "../../shared/api-types";

/** Mindestbreite (in Minuten) je Stück, damit kurze Fahrten lesbar bleiben */
const MIN_TRANSIT_WEIGHT = 7;
const MIN_WALK_WEIGHT = 2;
const MAX_WALK_WEIGHT = 8;

/** Balken: jede Fahrt als Stück in Linienfarbe, so lang wie sie dauert; Fußwege gepunktet */
function LegBar({ legs }: { legs: readonly JourneyLeg[] }) {
  return (
    <span className="flex h-5 items-center gap-0.5" aria-hidden="true">
      {legs.map((leg, index) => {
        if (leg.kind === "walk") {
          const weight = Math.min(MAX_WALK_WEIGHT, Math.max(MIN_WALK_WEIGHT, leg.durationMinutes));
          return (
            <span
              key={index}
              className="h-0.5 min-w-2 border-t-2 border-dotted border-muted-foreground/70"
              style={{ flexGrow: weight, flexBasis: 0 }}
            />
          );
        }
        const colors = lineBadgeColors(legBadge(leg));
        return (
          <span
            key={index}
            className={cn(
              "flex h-full min-w-7 items-center overflow-hidden rounded px-1 text-[0.7rem] font-bold whitespace-nowrap ring-1 ring-black/10 ring-inset dark:ring-white/15",
              colors.className,
              isLegCancelled(leg) && "line-through opacity-50",
            )}
            style={{
              ...colors.style,
              flexGrow: Math.max(MIN_TRANSIT_WEIGHT, leg.durationMinutes),
              flexBasis: 0,
            }}
          >
            <span className="truncate">{leg.line}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Zugänglicher Text zum Balken: „U76, Fußweg, RE1“ */
function legsText(legs: readonly JourneyLeg[]): string {
  return legs
    .map((leg) =>
      leg.kind === "walk" ? "Fußweg" : `${MODE_LABEL[leg.mode ?? "other"]} ${leg.line ?? ""}`,
    )
    .join(", ");
}

/** „ab 14:53 Gleis 2“ der ersten Fahrt, davor ggf. der Fußweg dorthin */
function Boarding({ journey }: { journey: Journey }) {
  const index = journey.legs.findIndex((l) => l.kind === "transit");
  const first = journey.legs[index];
  if (!first) {
    // nur zu Fuß
    return (
      <span className="min-w-0 truncate">
        <Footprints className="mr-0.5 inline size-3.5 align-[-0.2em]" aria-hidden="true" />
        Fußweg {formatDuration(journey.durationMinutes)}
      </span>
    );
  }
  const walk = journey.legs.slice(0, index).reduce((sum, l) => sum + l.durationMinutes, 0);
  const { plannedDeparture, realtimeDeparture, platform } = first.origin;
  // tatsächliche Abfahrt, sonst Plan (#124)
  const departure = realtimeDeparture ?? plannedDeparture;
  return (
    <span className="min-w-0 truncate">
      {walk > 0 && (
        <>
          <Footprints className="mr-0.5 inline size-3.5 align-[-0.2em]" aria-hidden="true" />
          {walk} Min, dann{" "}
        </>
      )}
      ab{" "}
      <span className="text-foreground">
        {departure ? formatClock(new Date(departure)) : first.origin.name}
        {platform !== null && ` ${platformLabel(first.mode ?? "other")} ${platform}`}
      </span>
    </span>
  );
}

function JourneyRow({
  journey,
  onSave,
  saved,
}: {
  journey: Journey;
  onSave?: () => void;
  saved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const legsId = useId();
  const times = journeyTimes(journey);
  const cancelled = isJourneyCancelled(journey);
  const risk = cancelled ? null : journeyTransferRisk(journey);
  const hasNotices = journey.legs.some((l) => l.notices.length > 0);

  return (
    <li data-cancelled={cancelled || undefined}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={legsId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full space-y-1.5 px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-expanded:bg-muted/40",
          cancelled && "border-l-4 border-l-destructive pl-2",
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-base font-semibold tabular-nums",
              cancelled && "text-muted-foreground",
            )}
          >
            <Clock
              planned={times.plannedDeparture}
              realtime={times.realtimeDeparture}
              cancelled={cancelled}
              badge
            />
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only"> bis </span>
            <Clock
              planned={times.plannedArrival}
              realtime={times.realtimeArrival}
              cancelled={cancelled}
              badge
            />
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
            {formatDuration(journey.durationMinutes)}
            <span aria-hidden="true">·</span>
            <span className="sr-only">, </span>
            {formatTransfers(journey.transfers)}
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </span>
        </span>
        <LegBar legs={journey.legs} />
        <span className="sr-only">{legsText(journey.legs)}. </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Boarding journey={journey} />
          {cancelled && (
            <span className="ml-auto shrink-0 font-semibold text-destructive">fällt aus</span>
          )}
          {risk && (
            <span
              className={cn(
                "ml-auto flex shrink-0 items-center gap-0.5 font-semibold",
                risk === "missed" ? "text-destructive" : "text-warning",
              )}
              data-transfer-risk={risk}
            >
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {TRANSFER_RISK_TEXT[risk]}
            </span>
          )}
          {!cancelled && !risk && hasNotices && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Hinweise
            </span>
          )}
        </span>
      </button>
      {expanded && <JourneyDetails id={legsId} journey={journey} onSave={onSave} saved={saved} />}
    </li>
  );
}

export function JourneyList({
  journeys,
  onSave,
  savedSignature,
}: {
  journeys: readonly Journey[];
  /** Verbindung für die Live-Begleitung merken */
  onSave?: (journey: Journey) => void;
  /** Signatur der gemerkten Verbindung (zeigt „Gemerkt“) */
  savedSignature?: string | null;
}) {
  return (
    <ul aria-label="Verbindungen" className="divide-y">
      {journeys.map((journey) => (
        <JourneyRow
          key={journey.id}
          journey={journey}
          onSave={onSave && (() => onSave(journey))}
          saved={savedSignature === journeySignature(journey)}
        />
      ))}
    </ul>
  );
}
