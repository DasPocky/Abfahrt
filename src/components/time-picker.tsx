// Auswahl eines Zeitpunkts (#102): Tag als Chips, Uhrzeit mit −15/+15 Minuten, Schnellwahl.
// Für die Verbindungssuche und den Zeitfilter der Abfahrten.
import { useId } from "react";
import { CalendarDays, Minus, Plus } from "lucide-react";
import { cn } from "cn";
import { Chip, CHIP_BASE, CHIP_OFF } from "@/components/chip";
import { Button } from "@/components/ui/button";
import {
  clockValue,
  dateValue,
  dayChoices,
  dayOffset,
  MAX_DAYS_AHEAD,
  QUICK_MINUTES,
  quickLabel,
  shiftMinutes,
  withClock,
  withDate,
  withDay,
} from "@/lib/journey-time";

export function TimePicker({
  time,
  now,
  onChange,
}: {
  /** ISO-8601, fehlt = jetzt */
  time: string | undefined;
  now: Date;
  /** undefined = jetzt */
  onChange: (time: string | undefined) => void;
}) {
  const clockId = useId();
  const selectedDay = dayOffset(time, now);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Tag" className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
        {dayChoices(now).map(({ offset, label: dayLabel }) => (
          <Chip
            key={offset}
            active={time !== undefined && selectedDay === offset}
            onClick={() => onChange(withDay(time, offset, now))}
          >
            {dayLabel}
          </Chip>
        ))}
        <label className={cn(CHIP_BASE, CHIP_OFF, "relative")}>
          <CalendarDays className="size-4" aria-hidden="true" />
          <span className="sr-only">Anderes Datum</span>
          {/* unsichtbares Datumsfeld über dem Chip: öffnet die Datumsauswahl des Systems */}
          <input
            type="date"
            className="absolute inset-0 opacity-0"
            min={dateValue(undefined, now)}
            max={dateValue(withDay(undefined, MAX_DAYS_AHEAD, now), now)}
            value={dateValue(time, now)}
            onChange={(event) => {
              const next = withDate(time, event.target.value, now);
              if (next) onChange(next);
            }}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="15 Minuten früher"
          onClick={() => onChange(shiftMinutes(time, -15, now))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <label htmlFor={clockId} className="sr-only">
          Uhrzeit
        </label>
        <input
          id={clockId}
          type="time"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-center text-lg font-semibold tabular-nums dark:bg-input/30"
          value={clockValue(time, now)}
          onChange={(event) => {
            const next = withClock(time, event.target.value, now);
            if (next) onChange(next);
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="15 Minuten später"
          onClick={() => onChange(shiftMinutes(time, 15, now))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <div role="group" aria-label="Schnellwahl" className="flex flex-wrap gap-1.5">
        <Chip active={time === undefined} onClick={() => onChange(undefined)}>
          Jetzt
        </Chip>
        {QUICK_MINUTES.map((minutes) => (
          <Chip
            key={minutes}
            active={false}
            onClick={() => onChange(shiftMinutes(undefined, minutes, now))}
          >
            {quickLabel(minutes)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
