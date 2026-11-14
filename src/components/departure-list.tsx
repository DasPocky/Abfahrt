import { TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { LineBadge } from "@/components/line-badge";
import { ModeIcon } from "@/components/mode-icon";
import {
  effectiveTime,
  hasPlatformChange,
  sortDepartures,
  upcomingDepartures,
} from "@/lib/departures";
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
  if (!hasPlatformChange(departure)) {
    return (
      <span>
        {label} {departure.platform}
      </span>
    );
  }
  return (
    <span
      className="rounded-sm bg-warning/15 px-1 font-semibold text-warning"
      data-platform-change="true"
    >
      {label} {departure.platform}{" "}
      <span className="font-normal">(statt {departure.plannedPlatform})</span>
    </span>
  );
}

function DepartureRow({ departure, now }: { departure: Departure; now: Date }) {
  const planned = new Date(departure.plannedTime);
  const delay = delayMinutes(departure.plannedTime, departure.realtimeTime);
  const tone = delayTone(delay);
  const countdown = formatCountdown(effectiveTime(departure), now);

  return (
    <li className="flex items-start gap-3 py-3" data-cancelled={departure.cancelled || undefined}>
      <div className="flex w-18 shrink-0 flex-col items-start gap-1">
        <LineBadge departure={departure} />
        <ModeIcon mode={departure.mode} className="size-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            departure.cancelled && "text-muted-foreground line-through",
          )}
        >
          {departure.direction}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            <time
              dateTime={departure.plannedTime}
              className={cn(departure.cancelled && "line-through")}
            >
              {formatClock(planned)}
            </time>
            {delay !== null && !departure.cancelled && (
              <span className={cn("ml-1 font-semibold", DELAY_CLASS[tone])} data-tone={tone}>
                {formatDelay(delay)}
              </span>
            )}
          </span>
          <Platform departure={departure} />
          {departure.cancelled && <span className="font-semibold text-destructive">fällt aus</span>}
        </p>
        {departure.notices.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {departure.notices.map((notice) => (
              <li key={notice} className="flex gap-1">
                <TriangleAlert className="mt-px size-3 shrink-0 text-warning" aria-hidden="true" />
                <span className="line-clamp-2">{notice}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "shrink-0 text-right text-lg font-semibold tabular-nums",
          departure.cancelled && "text-muted-foreground line-through",
        )}
      >
        {countdown}
      </div>
    </li>
  );
}

export function DepartureList({
  departures,
  now,
}: {
  departures: readonly Departure[];
  now: Date;
}) {
  const visible = upcomingDepartures(sortDepartures(departures), now);

  if (visible.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Zurzeit keine Abfahrten an dieser Haltestelle.
      </p>
    );
  }

  return (
    <ul aria-label="Abfahrten" className="divide-y">
      {visible.map((departure) => (
        <DepartureRow key={departure.id} departure={departure} now={now} />
      ))}
    </ul>
  );
}
