import { ChevronDown, Clock } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/chip";
import { TimePicker } from "@/components/time-picker";
import { timeChipLabel } from "@/lib/journeys";
import { shiftMinutes } from "@/lib/journey-time";

const SEGMENT_CLASS =
  "h-8 flex-1 rounded px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs text-muted-foreground hover:text-foreground dark:aria-pressed:bg-input/50";

/**
 * Zeit-Chip „Ab jetzt ▾“ mit Panel (#102): Abfahrt/Ankunft, Tag als Chips (Heute, Morgen,
 * Wochentage, Datumsfeld), Uhrzeit mit −15/+15 Minuten und Schnellwahl. Jede Änderung gilt sofort.
 */
export function JourneyTimeSheet({
  time,
  arrive,
  now,
  onChange,
}: {
  /** ISO-8601, fehlt = jetzt */
  time: string | undefined;
  arrive: boolean;
  now: Date;
  onChange: (time: string | undefined, arrive: boolean) => void;
}) {
  const label = timeChipLabel(time, arrive, now);
  return (
    <BottomSheet
      title="Zeitpunkt"
      description="Abfahrt oder Ankunft, Tag und Uhrzeit"
      triggerLabel={`Zeitpunkt: ${label}`}
      triggerClassName={cn(CHIP_BASE, "shrink-0", time ? CHIP_ON : CHIP_OFF)}
      trigger={
        <>
          <Clock className="size-4" aria-hidden="true" />
          {label}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
        </>
      }
    >
      <div className="space-y-4">
        <div
          role="group"
          aria-label="Zeitpunkt gilt für"
          className="flex rounded-md border bg-muted p-0.5"
        >
          <button
            type="button"
            className={SEGMENT_CLASS}
            aria-pressed={!arrive}
            onClick={() => onChange(time, false)}
          >
            Abfahrt
          </button>
          <button
            type="button"
            className={SEGMENT_CLASS}
            aria-pressed={arrive}
            // Ankunft braucht einen Zeitpunkt: ohne Auswahl gilt die aktuelle Uhrzeit
            onClick={() => onChange(time ?? shiftMinutes(undefined, 0, now), true)}
          >
            Ankunft
          </button>
        </div>

        <TimePicker
          time={time}
          now={now}
          onChange={(next) =>
            next === undefined ? onChange(undefined, false) : onChange(next, arrive)
          }
        />
      </div>
    </BottomSheet>
  );
}
