import { ChevronRight, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { LineBadge } from "@/components/line-badge";
import {
  effectiveTime,
  hasPlatformChange,
  sortDepartures,
  upcomingDepartures,
} from "@/lib/departures";
import { summarizeNotices } from "@/lib/notices";
import {
  delayMinutes,
  delayTone,
  formatClock,
  formatCountdown,
  formatDelay,
  type DelayTone,
} from "@/lib/time";
import type { Departure, TransportMode } from "../../shared/api-types";

const DELAY_CLASS: Record<DelayTone, string> = {
  unknown: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

const TRACK_MODES = new Set<TransportMode>(["subway", "suburban", "regional", "longdistance"]);

function platformLabel(mode: TransportMode): string {
  return TRACK_MODES.has(mode) ? "Gleis" : "Steig";
}

function Platform({ departure }: { departure: Departure }) {
  if (departure.platform === null) return null;
  const label = platformLabel(departure.mode);
  const short = label === "Gleis" ? "Gl." : "Stg.";
  if (!hasPlatformChange(departure)) {
    return (
      <span
        className="rounded border px-1 text-xs leading-5 text-foreground/80"
        title={`${label} ${departure.platform}`}
      >
        <span className="sr-only">{label} </span>
        <span aria-hidden="true">{short} </span>
        {departure.platform}
      </span>
    );
  }
  return (
    <span
      className="rounded border border-warning/40 bg-warning/15 px-1 text-xs leading-5 font-semibold text-warning"
      data-platform-change="true"
    >
      <span className="sr-only">{label} </span>
      <span aria-hidden="true">{short} </span>
      {departure.platform} <span className="font-normal">statt {departure.plannedPlatform}</span>
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
      triggerClassName="flex w-full items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-left text-sm font-medium outline-none hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring"
      trigger={
        <>
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="flex-1">{noticeCount(notices.length)} für diese Haltestelle</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </>
      }
    >
      <NoticeList notices={notices} />
    </BottomSheet>
  );
}

/** ⓘ-Button in der Zeile, öffnet die Hinweise zu dieser Fahrt */
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
      triggerLabel={`${notices.length > 1 ? `${notices.length} ` : ""}Hinweise zu ${departure.line} anzeigen`}
      triggerClassName="-m-1.5 inline-flex min-h-8 min-w-8 items-center justify-center gap-0.5 rounded-full p-1.5 text-warning outline-none hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring"
      trigger={
        <>
          <Info className="size-4" aria-hidden="true" />
          {notices.length > 1 && (
            <span className="text-xs font-semibold" aria-hidden="true">
              {notices.length}
            </span>
          )}
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
      className="flex items-center gap-3 py-2.5"
      data-cancelled={departure.cancelled || undefined}
    >
      <LineBadge departure={departure} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            departure.cancelled && "text-muted-foreground line-through",
          )}
        >
          {departure.direction}
        </p>
        <div className="mt-0.5 flex items-center gap-x-2 overflow-hidden text-sm whitespace-nowrap text-muted-foreground">
          <span className="tabular-nums">
            <time
              dateTime={departure.plannedTime}
              className={cn(departure.cancelled && "line-through")}
            >
              {formatClock(planned)}
            </time>
            {delay !== null && !departure.cancelled && (
              <span
                className={cn(
                  "ml-1",
                  delay === 0 ? "font-normal" : "font-semibold",
                  DELAY_CLASS[tone],
                )}
                data-tone={tone}
              >
                {formatDelay(delay)}
              </span>
            )}
          </span>
          {!departure.cancelled && <Platform departure={departure} />}
          {departure.cancelled && <span className="font-semibold text-destructive">fällt aus</span>}
          <DepartureNotices departure={departure} notices={notices} />
        </div>
      </div>

      <div
        className={cn(
          "min-w-10 shrink-0 text-right text-base leading-tight font-bold tabular-nums",
          departure.cancelled && "text-muted-foreground line-through",
        )}
      >
        {minutes ? (
          <span className="flex flex-col items-end leading-none" aria-label={countdown}>
            <span className="text-xl">{minutes}</span>
            <span className="text-[0.7rem] font-medium text-muted-foreground" aria-hidden="true">
              Min
            </span>
          </span>
        ) : (
          countdown
        )}
      </div>
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
