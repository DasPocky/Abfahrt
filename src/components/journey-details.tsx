// Aufgeklappte Verbindung: Abschnitte mit Gleis, Zwischenhalten, Fußwegen, Umstiegen und Hinweisen
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bookmark,
  BookmarkCheck,
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
import { otherPlace } from "@/lib/stop-label";
import { hasRoute } from "@/lib/route-map";
import { lineBadgeColors, type LineBadgeColors } from "@/lib/line-colors";
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

/** Spalten der Zeitleiste: Zeit | Linie mit Punkten | Inhalt */
const GRID = "grid grid-cols-[3.25rem_0.875rem_minmax(0,1fr)] gap-x-2";
/** Inhalt ohne Zeit und Punkt auf Höhe der Namen einrücken */
const INDENT = "col-start-3";

/** Punkt auf der Linie: Ring in Linienfarbe (Fußweg: grau) */
function Node({ colors, small = false }: { colors: LineBadgeColors | null; small?: boolean }) {
  return (
    <span
      className={cn(
        "relative z-10 mx-auto mt-[0.2rem] block rounded-full",
        small ? "size-2 p-[2px]" : "size-3 p-[3px]",
        colors ? colors.className : "bg-muted-foreground",
      )}
      style={colors?.style ? { backgroundColor: colors.style.backgroundColor } : undefined}
      aria-hidden="true"
    >
      <span className="block size-full rounded-full bg-card" />
    </span>
  );
}

/** Halt in der Zeitleiste: Zeit, Punkt, Name mit Gleis/Steig (Gleiswechsel in Orange) */
/** Stadt des Starts; Halte in anderen Städten zeigen ihren Ort (#94) */
const HomePlace = createContext<string | undefined>(undefined);

function StopRow({
  stop,
  mode,
  time,
  colors,
  small = false,
}: {
  stop: JourneyStop;
  mode: TransportMode;
  time: "departure" | "arrival" | "auto";
  colors: LineBadgeColors | null;
  small?: boolean;
}) {
  const place = otherPlace(stop.place, useContext(HomePlace));
  const useDeparture = time === "departure" || (time === "auto" && stop.plannedDeparture !== null);
  const planned = useDeparture ? stop.plannedDeparture : stop.plannedArrival;
  const realtime = useDeparture ? stop.realtimeDeparture : stop.realtimeArrival;
  const changed =
    stop.platform !== null &&
    stop.plannedPlatform !== null &&
    stop.platform !== stop.plannedPlatform;
  return (
    <div className={cn(GRID, small ? "text-muted-foreground" : "")}>
      {/* linksbündig: die Uhrzeiten stehen untereinander, die Verspätung dahinter (#96) */}
      <span className={cn("tabular-nums", !small && "font-semibold")}>
        <Clock planned={planned} realtime={realtime} cancelled={stop.cancelled} />
      </span>
      <Node colors={colors} small={small} />
      <span className="min-w-0">
        <span className={cn(!small && "font-semibold", stop.cancelled && "line-through")}>
          {stop.name}
        </span>
        {place && <span className="text-muted-foreground">, {place}</span>}
        {stop.platform !== null && !stop.cancelled && (
          <span
            className={cn(
              "font-normal text-muted-foreground",
              changed && "font-semibold text-warning",
            )}
          >
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
    </div>
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
  const [stopsOpen, setStopsOpen] = useState(false);
  const stopsId = useId();
  const mode = leg.mode ?? "other";
  const cancelled = isLegCancelled(leg);
  const colors = lineBadgeColors(legBadge(leg));
  const stops = leg.intermediateStops;
  const cancelledStops = stops.filter((st) => st.cancelled).length;
  return (
    <li className="relative space-y-1" data-cancelled={cancelled || undefined}>
      {/* durchgehende Linie in Linienfarbe zwischen Start- und Zielpunkt */}
      <span
        className={cn(
          "absolute top-2 bottom-2 left-[calc(3.25rem+0.5rem+0.4375rem-2px)] w-1 rounded-full",
          colors.className,
          cancelled && "opacity-40",
        )}
        style={colors.style ? { backgroundColor: colors.style.backgroundColor } : undefined}
        aria-hidden="true"
      />
      <StopRow stop={leg.origin} mode={mode} time="departure" colors={colors} />
      <div className={GRID}>
        <div className={cn(INDENT, "space-y-1 py-0.5 text-muted-foreground")}>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <LineBadge
              departure={legBadge(leg)}
              className={cn("h-5 w-auto max-w-20 text-[0.7rem]", cancelled && "opacity-60")}
            />
            {leg.direction && <span className="min-w-0 truncate">Richtung {leg.direction}</span>}
          </p>
          {/* eigene Zeile: bricht nicht mitten in Linie/Richtung um (#96) */}
          {stops.length > 0 && (
            <button
              type="button"
              aria-expanded={stopsOpen}
              aria-controls={stopsId}
              onClick={() => setStopsOpen((v) => !v)}
              className="-mx-1 inline-flex items-center gap-0.5 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {stops.length === 1 ? "1 Zwischenhalt" : `${stops.length} Zwischenhalte`}
              {cancelledStops > 0 && (
                <span className="font-semibold text-destructive">
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  {cancelledStops === 1 ? "1 entfällt" : `${cancelledStops} entfallen`}
                </span>
              )}
              <ChevronDown
                className={cn("size-3.5 shrink-0 transition-transform", stopsOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          )}
          {cancelled && <p className="font-semibold text-destructive">Fahrt fällt aus</p>}
          <LegNotices leg={leg} />
        </div>
      </div>
      {stopsOpen && (
        <ol
          id={stopsId}
          aria-label={`Zwischenhalte ${leg.line ?? ""}`.trim()}
          className="space-y-1"
        >
          {stops.map((stop, index) => (
            <li key={`${stop.id ?? stop.name}-${index}`}>
              <StopRow stop={stop} mode={mode} time="auto" colors={colors} small />
            </li>
          ))}
        </ol>
      )}
      <StopRow stop={leg.destination} mode={mode} time="arrival" colors={colors} />
    </li>
  );
}

/** Fußweg: am Anfang bzw. Ende mit dem Start- oder Zielpunkt (Adresse), sonst nur die Zeile */
function WalkLeg({ leg, position }: { leg: JourneyLeg; position: "first" | "middle" | "last" }) {
  return (
    <li className="relative space-y-1">
      {position !== "middle" && (
        <span
          className="absolute top-2 bottom-2 left-[calc(3.25rem+0.5rem+0.4375rem-1px)] border-l-2 border-dotted border-muted-foreground/60"
          aria-hidden="true"
        />
      )}
      {position === "first" && (
        <StopRow stop={leg.origin} mode="other" time="departure" colors={null} />
      )}
      <div className={GRID}>
        <p className={cn(INDENT, "flex items-center gap-1.5 py-0.5 text-muted-foreground")}>
          <Footprints className="size-3.5 shrink-0" aria-hidden="true" />
          {walkText(leg)}
        </p>
      </div>
      {position === "last" && (
        <StopRow stop={leg.destination} mode="other" time="arrival" colors={null} />
      )}
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
    <li className={GRID} data-transfer={transfer.status}>
      <p className={cn(INDENT, "flex items-center gap-1.5", TRANSFER_TONE[transfer.status])}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {text}
      </p>
    </li>
  );
}

/** Knopf „Karte“ (darunter die lazy geladene Routenkarte), daneben optional „Merken“ */
function RouteMapToggle({ journey, action }: { journey: Journey; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const route = hasRoute(journey);
  if (!route && !action) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {route && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2.5 font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Karte
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        )}
        {action}
      </div>
      {open && (
        <div id={id}>
          <LazyRouteMap journey={journey} />
        </div>
      )}
    </div>
  );
}

/** Zeitleiste der Abschnitte; Umstiege stehen direkt vor der Anschlussfahrt, oben die Karte */
export function JourneyDetails({
  id,
  journey,
  onSave,
  saved = false,
}: {
  id: string;
  journey: Journey;
  /** „Merken“ für die Live-Begleitung; ohne Rückruf kein Knopf (z. B. in der Live-Ansicht) */
  onSave?: () => void;
  saved?: boolean;
}) {
  const transfers = new Map(journeyTransfers(journey).map((t) => [t.toLeg, t]));
  const last = journey.legs.length - 1;
  // Startstadt: erste Fahrt (ein Fußweg beginnt oft an einer Adresse ohne Ort)
  const home =
    journey.legs.find((l) => l.kind === "transit")?.origin.place ?? journey.legs[0]?.origin.place;
  return (
    <HomePlace value={home}>
      <div id={id} className="space-y-2 border-t bg-muted/40 px-3 py-2.5 text-xs">
        <RouteMapToggle
          journey={journey}
          action={
            onSave && (
              <button
                type="button"
                onClick={onSave}
                aria-pressed={saved}
                className="inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2.5 font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground"
              >
                {saved ? (
                  <BookmarkCheck className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Bookmark className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {saved ? "Gemerkt · live ansehen" : "Merken & live verfolgen"}
              </button>
            )
          }
        />
        <ol aria-label="Abschnitte" className="space-y-2">
          {journey.legs.map((leg, index) => {
            const transfer = transfers.get(index);
            const position = index === 0 ? "first" : index === last ? "last" : "middle";
            return [
              transfer && <TransferRow key={`t${index}`} transfer={transfer} />,
              leg.kind === "walk" ? (
                <WalkLeg key={index} leg={leg} position={position} />
              ) : (
                <TransitLeg key={index} leg={leg} />
              ),
            ];
          })}
        </ol>
      </div>
    </HomePlace>
  );
}
