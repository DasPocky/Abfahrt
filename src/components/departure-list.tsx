import { ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { LineBadge } from "@/components/line-badge";
import {
  effectiveTime,
  hasPlatformChange,
  sortDepartures,
  upcomingDepartures,
} from "@/lib/departures";
import { platformLabel } from "@/lib/modes";
import { summarizeNotices } from "@/lib/notices";
import {
  delayMinutes,
  delayTone,
  formatClock,
  formatCountdown,
  formatDelay,
  type DelayTone,
} from "@/lib/time";
import type { Departure } from "../../shared/api-types";

const DELAY_CLASS: Record<DelayTone, string> = {
  unknown: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/** Kleines Kästchen in fester Spalte: „Gleis“/„Steig“ über der Nummer, Gleiswechsel in Orange */
function Platform({ departure }: { departure: Departure }) {
  if (departure.platform === null || departure.cancelled) return <span aria-hidden="true" />;
  const label = platformLabel(departure.mode);
  const changed = hasPlatformChange(departure);
  return (
    <span
      className={cn(
        "flex w-12 flex-col items-center rounded-md border px-0.5 py-0.5 leading-none",
        changed && "border-warning/40 bg-warning/10 text-warning",
      )}
      data-platform-change={changed || undefined}
    >
      <span
        className={cn(
          "text-[0.55rem] font-medium tracking-wide uppercase",
          changed ? "text-warning" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{departure.platform}</span>
      {changed && (
        <span className="text-[0.55rem] font-semibold">statt {departure.plannedPlatform}</span>
      )}
    </span>
  );
}

/** Liste der Hinweise im Panel */
function NoticeList({ notices }: { notices: readonly string[] }) {
  return (
    <ul className="space-y-3">
      {notices.map((notice) => (
        <li key={notice} className="flex gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="leading-relaxed">{notice}</span>
        </li>
      ))}
    </ul>
  );
}

function noticeCount(count: number): string {
  return count === 1 ? "1 Hinweis" : `${count} Hinweise`;
}

/** Gemeinsamer Stil für Hinweis-Auslöser (Haltestelle und Fahrt) */
const NOTICE_CLASS =
  "flex w-full items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-left text-sm outline-none hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Sammelhinweis: Hinweise, die mehrere Fahrten betreffen. Steht als eigener Kasten über der
 * Abfahrtsliste (nicht in der Karte); die Liste blendet diese Hinweise in den Zeilen aus.
 */
export function StopNoticesBanner({
  departures,
  now,
}: {
  departures: readonly Departure[];
  now: Date;
}) {
  const visible = upcomingDepartures(sortDepartures(departures), now);
  const notices = summarizeNotices(visible).stopNotices;
  if (notices.length === 0) return null;
  return (
    <BottomSheet
      title="Hinweise für diese Haltestelle"
      description="Betreffen mehrere Abfahrten"
      triggerClassName={NOTICE_CLASS}
      trigger={
        <>
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">
              {noticeCount(notices.length)} für diese Haltestelle:
            </span>{" "}
            {notices[0]}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </>
      }
    >
      <NoticeList notices={notices} />
    </BottomSheet>
  );
}

/** Schlanke Hinweiszeile unter der Fahrt, öffnet alle Hinweise im Panel */
function DepartureNotices({
  departure,
  notices,
}: {
  departure: Departure;
  notices: readonly string[];
}) {
  if (notices.length === 0) return null;
  return (
    <BottomSheet
      title={`Hinweise zu ${departure.line}`}
      description={`${departure.direction}, ${formatClock(new Date(departure.plannedTime))}`}
      triggerLabel={`${notices.length > 1 ? `${notices.length} ` : ""}Hinweise zu ${departure.line} anzeigen: ${notices[0]}`}
      triggerClassName={cn(NOTICE_CLASS, "py-1 text-xs")}
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

function DepartureRow({
  departure,
  notices,
  now,
}: {
  departure: Departure;
  /** Hinweise nur zu dieser Fahrt (ohne Sammelhinweise der Haltestelle) */
  notices: readonly string[];
  now: Date;
}) {
  const planned = new Date(departure.plannedTime);
  const delay = delayMinutes(departure.plannedTime, departure.realtimeTime);
  const tone = delayTone(delay);
  const countdown = formatCountdown(effectiveTime(departure), now);
  // „in 7 Min“ gestapelt als große Zahl + „Min“, spart Breite für die Meta-Zeile
  const minutes = /^in (\d+) Min$/.exec(countdown)?.[1];

  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)_auto_2.75rem] items-center gap-x-2.5 gap-y-1 py-2"
      data-cancelled={departure.cancelled || undefined}
    >
      <LineBadge departure={departure} />

      <div className="min-w-0">
        <p
          className={cn(
            "truncate leading-tight font-medium",
            departure.cancelled && "text-muted-foreground line-through",
          )}
        >
          {departure.direction}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
          ab{" "}
          <time
            dateTime={departure.plannedTime}
            className={cn("text-foreground", departure.cancelled && "line-through")}
          >
            {formatClock(planned)}
          </time>
          {delay !== null && !departure.cancelled && (
            <span
              className={cn("ml-1.5", delay === 0 ? "" : "font-semibold", DELAY_CLASS[tone])}
              data-tone={tone}
            >
              {formatDelay(delay)}
            </span>
          )}
          {departure.cancelled && (
            <span className="ml-1.5 font-semibold text-destructive">fällt aus</span>
          )}
        </p>
      </div>

      <Platform departure={departure} />

      <div
        className={cn(
          "text-right leading-none font-bold tabular-nums",
          departure.cancelled && "text-muted-foreground line-through",
        )}
      >
        {minutes ? (
          <span className="flex flex-col items-end" aria-label={countdown}>
            <span className="text-lg leading-none">{minutes}</span>
            <span className="text-[0.65rem] font-medium text-muted-foreground" aria-hidden="true">
              Min
            </span>
          </span>
        ) : (
          <span className="text-sm">{countdown}</span>
        )}
      </div>

      {notices.length > 0 && (
        <div className="col-span-3 col-start-2">
          <DepartureNotices departure={departure} notices={notices} />
        </div>
      )}
    </li>
  );
}

export function DepartureList({
  departures,
  now,
  compact = false,
}: {
  departures: readonly Departure[];
  now: Date;
  /** Kompakte Vorschau (Favoriten): Hinweise nur per ⓘ, kein Sammelhinweis */
  compact?: boolean;
}) {
  const visible = upcomingDepartures(sortDepartures(departures), now);

  if (visible.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Zurzeit keine Abfahrten an dieser Haltestelle.
      </p>
    );
  }

  // Ohne compact stehen Sammelhinweise im StopNoticesBanner über der Liste
  const departureNotices = compact
    ? new Map(visible.map((d) => [d.id, d.notices]))
    : summarizeNotices(visible).departureNotices;

  return (
    <>
      <ul aria-label="Abfahrten" className="divide-y">
        {visible.map((departure) => (
          <DepartureRow
            key={departure.id}
            departure={departure}
            notices={departureNotices.get(departure.id) ?? []}
            now={now}
          />
        ))}
      </ul>
    </>
  );
}
