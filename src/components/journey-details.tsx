// Aufgeklappte Verbindung: Abschnitte mit Gleis, Zwischenhalten, Fußwegen, Umstiegen und Hinweisen
import { useId, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Footprints,
  Map as MapIcon,
  TriangleAlert,
} from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { NOTICE_CLASS, NoticeList } from "@/components/departure-list";
import { LazyRouteMap } from "@/components/lazy-route-map";
import { LineBadge } from "@/components/line-badge";
import {
  formatTransfer,
  journeyTransfers,
  legBadge,
  walkText,
  type Transfer,
} from "@/lib/connections";
import { isLegCancelled } from "@/lib/journeys";
import { platformLabel } from "@/lib/modes";
import { hasRoute } from "@/lib/route-map";
import { DELAY_TONE_CLASS, delayMinutes, delayTone, formatClock, formatDelay } from "@/lib/time";
import type { Journey, JourneyLeg, JourneyStop, TransportMode } from "../../shared/api-types";

/** Uhrzeit laut Plan, dahinter die Verspätung in den Farben der Abfahrtsliste */
export function Clock({
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

/** Einrückung auf Höhe der Haltestellennamen (Zeitspalte w-14 + gap-1.5) */
const INDENT = "pl-[3.875rem]";

/** Halt: Zeit, Name, Gleis/Steig (Gleiswechsel in Orange), Ausfall durchgestrichen */
function LegStop({
  stop,
  mode,
  time,
  muted = false,
}: {
  stop: JourneyStop;
  mode: TransportMode;
  /** Zwischenhalte: Abfahrt, sonst Ankunft */
  time: "departure" | "arrival" | "auto";
  muted?: boolean;
}) {
  const useDeparture = time === "departure" || (time === "auto" && stop.plannedDeparture !== null);
  const planned = useDeparture ? stop.plannedDeparture : stop.plannedArrival;
  const realtime = useDeparture ? stop.realtimeDeparture : stop.realtimeArrival;
  const changed =
    stop.platform !== null &&
    stop.plannedPlatform !== null &&
    stop.platform !== stop.plannedPlatform;
  return (
    <p className={cn("flex gap-1.5", muted && "text-muted-foreground")}>
      <span className="w-14 shrink-0 tabular-nums">
        <Clock planned={planned} realtime={realtime} cancelled={stop.cancelled} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn(stop.cancelled && "line-through")}>{stop.name}</span>
        {stop.platform !== null && !stop.cancelled && (
          <span className={cn("text-muted-foreground", changed && "font-semibold text-warning")}>
            {" · "}
            {platformLabel(mode)} {stop.platform}
            {changed && ` statt ${stop.plannedPlatform}`}
          </span>
        )}
        {stop.cancelled && (
          <span className="font-semibold text-destructive">
            {" · "}
            entfällt
          </span>
        )}
      </span>
    </p>
  );
}

/** „3 Zwischenhalte“ als Schalter, aufgeklappt die Halte mit Zeit und Gleis */
function IntermediateStops({ leg }: { leg: JourneyLeg }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const stops = leg.intermediateStops;
  const cancelledCount = stops.filter((s) => s.cancelled).length;
  const mode = leg.mode ?? "other";

  if (stops.length === 0) return null;
  return (
    <>
      <p className={INDENT}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="-mx-1 inline-flex items-center gap-0.5 rounded px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {stops.length === 1 ? "1 Zwischenhalt" : `${stops.length} Zwischenhalte`}
          {cancelledCount > 0 && (
            <span className="font-semibold text-destructive">
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {cancelledCount === 1 ? "1 entfällt" : `${cancelledCount} entfallen`}
            </span>
          )}
          <ChevronDown
            className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </p>
      {open && (
        <ol id={id} aria-label={`Zwischenhalte ${leg.line ?? ""}`.trim()} className="space-y-0.5">
          {stops.map((stop, index) => (
            <li key={`${stop.id ?? stop.name}-${index}`}>
              <LegStop stop={stop} mode={mode} time="auto" muted />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** Hinweise kompakt: erste Zeile gekürzt, alle im Panel */
function LegNotices({ leg }: { leg: JourneyLeg }) {
  const notices = leg.notices;
  if (notices.length === 0) return null;
  const line = leg.line ?? "Fahrt";
  return (
    <BottomSheet
      title={`Hinweise zu ${line}`}
      description={leg.direction ? `Richtung ${leg.direction}` : undefined}
      triggerLabel={`${notices.length > 1 ? `${notices.length} ` : ""}Hinweise zu ${line} anzeigen: ${notices[0]}`}
      triggerClassName={cn(NOTICE_CLASS, "py-0.5 text-xs")}
      trigger={
        <>
          <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{notices[0]}</span>
          {notices.length > 1 && (
            <span className="shrink-0 text-muted-foreground">+{notices.length - 1}</span>
          )}
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </>
      }
    >
      <NoticeList notices={notices} />
    </BottomSheet>
  );
}

function TransitLeg({ leg }: { leg: JourneyLeg }) {
  const mode = leg.mode ?? "other";
  const cancelled = isLegCancelled(leg);
  return (
    <li className="flex items-start gap-2" data-cancelled={cancelled || undefined}>
      <LineBadge
        departure={legBadge(leg)}
        className={cn("h-5 w-auto max-w-20 text-[0.7rem]", cancelled && "opacity-60")}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <LegStop stop={leg.origin} mode={mode} time="departure" />
        {leg.direction && (
          <p className={cn(INDENT, "truncate text-muted-foreground")}>Richtung {leg.direction}</p>
        )}
        <IntermediateStops leg={leg} />
        <LegStop stop={leg.destination} mode={mode} time="arrival" />
        {cancelled && (
          <p className={cn(INDENT, "font-semibold text-destructive")}>Fahrt fällt aus</p>
        )}
        <LegNotices leg={leg} />
      </div>
    </li>
  );
}

const TRANSFER_TONE = {
  ok: "text-muted-foreground",
  tight: "font-semibold text-warning",
  missed: "font-semibold text-destructive",
  unknown: "text-muted-foreground",
} as const;

function TransferRow({ transfer }: { transfer: Transfer }) {
  const text = formatTransfer(transfer);
  if (text === null) return null;
  const Icon = transfer.status === "ok" ? ArrowLeftRight : TriangleAlert;
  return (
    <li
      className={cn("flex items-center gap-1.5", TRANSFER_TONE[transfer.status])}
      data-transfer={transfer.status}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </li>
  );
}

/** Knopf „Karte“ und darunter die lazy geladene Routenkarte */
function RouteMapToggle({ journey }: { journey: Journey }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!hasRoute(journey)) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground"
      >
        <MapIcon className="size-3.5 shrink-0" aria-hidden="true" />
        Karte
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={id}>
          <LazyRouteMap journey={journey} />
        </div>
      )}
    </div>
  );
}

/** Abschnitte untereinander; Umstiege stehen direkt vor der Anschlussfahrt, darunter die Karte */
export function JourneyDetails({ id, journey }: { id: string; journey: Journey }) {
  const transfers = new Map(journeyTransfers(journey).map((t) => [t.toLeg, t]));
  return (
    <div id={id} className="space-y-1.5 border-t px-3 py-2 text-xs">
      <ol aria-label="Abschnitte" className="space-y-1.5">
        {journey.legs.map((leg, index) => {
          const transfer = transfers.get(index);
          return [
            transfer && <TransferRow key={`t${index}`} transfer={transfer} />,
            leg.kind === "walk" ? (
              <li key={index} className="flex items-center gap-1.5 text-muted-foreground">
                <Footprints className="size-3.5 shrink-0" aria-hidden="true" />
                {walkText(leg)}
              </li>
            ) : (
              <TransitLeg key={index} leg={leg} />
            ),
          ];
        })}
      </ol>
      <RouteMapToggle journey={journey} />
    </div>
  );
}
