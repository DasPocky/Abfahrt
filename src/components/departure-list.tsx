import { ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { LineBadge } from "@/components/line-badge";
import { useSettings } from "@/hooks/use-settings";
import {
  effectiveTime,
  hasPlatformChange,
  sortDepartures,
  upcomingDepartures,
} from "@/lib/departures";
import { lineBadgeColors } from "@/lib/line-colors";
import { platformLabel } from "@/lib/modes";
import { summarizeNotices } from "@/lib/notices";
import type { RowStyle } from "@/lib/settings";
import {
  delayMinutes,
  DELAY_PILL_CLASS,
  DELAY_TONE_CLASS,
  delayTone,
  formatClock,
  formatCountdown,
  formatDelay,
} from "@/lib/time";
import type { Departure } from "../../shared/api-types";

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

/** Liste der Hinweise im Panel (auch in den Verbindungsdetails) */
export function NoticeList({ notices }: { notices: readonly string[] }) {
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

/** Gemeinsamer Stil für Hinweis-Auslöser (Haltestelle, Fahrt, Verbindungsabschnitt) */
export const NOTICE_CLASS =
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

/**
 * Abfahrtszeit: bei Verspätung zuerst die tatsächliche Zeit, die Planzeit klein durchgestrichen
 * daneben (#124); pünktlich dezent grün; Ausfall mit durchgestrichener Planzeit.
 */
function Meta({ departure }: { departure: Departure }) {
  const delay = departure.cancelled
    ? null
    : delayMinutes(departure.plannedTime, departure.realtimeTime);
  const planned = (
    <time
      dateTime={departure.plannedTime}
      className={cn(
        delay !== null && delay !== 0
          ? "ml-1.5 text-muted-foreground line-through"
          : "text-foreground",
        departure.cancelled && "line-through",
      )}
      aria-label={
        delay !== null && delay !== 0
          ? `geplant ${formatClock(new Date(departure.plannedTime))}`
          : undefined
      }
    >
      {formatClock(new Date(departure.plannedTime))}
    </time>
  );
  return (
    <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
      ab{" "}
      {delay !== null && delay !== 0 && departure.realtimeTime !== null ? (
        <>
          <time
            dateTime={departure.realtimeTime}
            className={cn("font-semibold", DELAY_TONE_CLASS[delayTone(delay)])}
          >
            {formatClock(new Date(departure.realtimeTime))}
          </time>
          {planned}
        </>
      ) : (
        planned
      )}
      {delay === 0 && (
        <span className={cn("ml-1.5", DELAY_TONE_CLASS.success)} data-tone="success">
          {formatDelay(0)}
        </span>
      )}
      {departure.cancelled && (
        <span className="ml-1.5 font-semibold text-destructive">fällt aus</span>
      )}
    </p>
  );
}

/** Verspätung als farbiges Kästchen direkt am Countdown (#124), z. B. „+2“ */
function DelayPill({ departure }: { departure: Departure }) {
  if (departure.cancelled) return null;
  const delay = delayMinutes(departure.plannedTime, departure.realtimeTime);
  if (delay === null || delay === 0) return null;
  const tone = delayTone(delay);
  return (
    <span
      className={cn(
        "mt-1 inline-block rounded px-1 py-0.5 text-[0.7rem] leading-none font-bold tabular-nums",
        DELAY_PILL_CLASS[tone],
      )}
      data-tone={tone}
      title={delay > 0 ? `${delay} Min später` : `${-delay} Min früher`}
    >
      {formatDelay(delay)}
    </span>
  );
}

/** Countdown: „in 7 Min“ gestapelt als große Zahl + „Min“, spart Breite */
function Countdown({
  departure,
  now,
  align,
  large = false,
}: {
  departure: Departure;
  now: Date;
  align: "left" | "right";
  large?: boolean;
}) {
  const countdown = formatCountdown(effectiveTime(departure), now);
  const minutes = /^in (\d+) Min$/.exec(countdown)?.[1];
  return (
    <div
      className={cn(
        "leading-none font-bold tabular-nums",
        align === "right" ? "text-right" : "text-left",
        departure.cancelled && "text-muted-foreground line-through",
      )}
    >
      {minutes ? (
        <span
          className={cn("flex flex-col", align === "right" ? "items-end" : "items-start")}
          aria-label={countdown}
        >
          <span className={cn("leading-none", large ? "text-2xl" : "text-lg")}>{minutes}</span>
          <span className="text-[0.65rem] font-medium text-muted-foreground" aria-hidden="true">
            Min
          </span>
        </span>
      ) : (
        <span className="text-sm">{countdown}</span>
      )}
      <DelayPill departure={departure} />
    </div>
  );
}

function Direction({ departure }: { departure: Departure }) {
  return (
    <p
      className={cn(
        "truncate leading-tight font-medium",
        departure.cancelled && "text-muted-foreground line-through",
      )}
    >
      {departure.direction}
    </p>
  );
}

/** Abfahrtszeile in der gewählten Darstellung (#37) */
function DepartureRow({
  departure,
  notices,
  now,
  rowStyle,
}: {
  departure: Departure;
  /** Hinweise nur zu dieser Fahrt (ohne Sammelhinweise der Haltestelle) */
  notices: readonly string[];
  now: Date;
  rowStyle: RowStyle;
}) {
  const noticeRow = notices.length > 0 && (
    <div className="col-span-3 col-start-2">
      <DepartureNotices departure={departure} notices={notices} />
    </div>
  );

  if (rowStyle === "b") {
    // B · Anzeigetafel: große Minuten vorne, Linie + Ziel, Gleis rechts
    return (
      <li
        className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 py-2"
        data-cancelled={departure.cancelled || undefined}
      >
        <Countdown departure={departure} now={now} align="left" large />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <LineBadge departure={departure} size="sm" />
            <Direction departure={departure} />
          </div>
          <Meta departure={departure} />
        </div>
        <Platform departure={departure} />
        {noticeRow}
      </li>
    );
  }

  const content = (
    <>
      <LineBadge departure={departure} />
      <div className="min-w-0">
        <Direction departure={departure} />
        <Meta departure={departure} />
      </div>
      <Platform departure={departure} />
      <Countdown departure={departure} now={now} align="right" />
      {noticeRow}
    </>
  );

  if (rowStyle === "c") {
    // C · Karte mit Farbstreifen der Linie links
    const colors = lineBadgeColors(departure);
    return (
      <li
        className="relative grid grid-cols-[auto_minmax(0,1fr)_auto_2.75rem] items-center gap-x-2.5 gap-y-1 overflow-hidden rounded-lg border bg-card py-2 pr-2.5 pl-3.5"
        data-cancelled={departure.cancelled || undefined}
      >
        <span
          className={cn("absolute inset-y-0 left-0 w-1.5", colors.className)}
          style={colors.style ? { backgroundColor: colors.style.backgroundColor } : undefined}
          aria-hidden="true"
        />
        {content}
      </li>
    );
  }

  // A · Linie mit Symbol in einem Feld (Standard)
  return (
    <li
      className="grid grid-cols-[auto_minmax(0,1fr)_auto_2.75rem] items-center gap-x-2.5 gap-y-1 py-2"
      data-cancelled={departure.cancelled || undefined}
    >
      {content}
    </li>
  );
}

export function DepartureList({
  departures,
  now,
  compact = false,
  rowStyle,
}: {
  departures: readonly Departure[];
  now: Date;
  /** Darstellung; ohne Angabe die aus den Einstellungen (#37) */
  rowStyle?: RowStyle;
  /** Kompakte Vorschau (Favoriten): Hinweise nur per ⓘ, kein Sammelhinweis */
  compact?: boolean;
}) {
  const settings = useSettings();
  const style = rowStyle ?? settings.rowStyle;
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
      <ul aria-label="Abfahrten" className={style === "c" ? "space-y-2" : "divide-y"}>
        {visible.map((departure) => (
          <DepartureRow
            key={departure.id}
            departure={departure}
            notices={departureNotices.get(departure.id) ?? []}
            now={now}
            rowStyle={style}
          />
        ))}
      </ul>
    </>
  );
}
