import { SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { Chip, CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { countJourneyOptions } from "@/lib/journeys";
import { MODE_LABEL } from "@/lib/modes";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  type JourneyOptions,
  type TransferSpeed,
} from "../../shared/journey-options";

const TRANSFER_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: "Beliebig" },
  { value: 0, label: "Direkt" },
  { value: 1, label: "Max. 1" },
  { value: 2, label: "Max. 2" },
];

const SPEED_CHOICES: { value: TransferSpeed; label: string }[] = [
  { value: "fast", label: "Kurz" },
  { value: "normal", label: "Normal" },
  { value: "slow", label: "Mehr Zeit" },
];

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Optionen-Knopf mit Panel: Verkehrsmittel, Umstiege, Umstiegszeit, barrierefrei */
export function JourneyOptionsSheet({
  options,
  onChange,
}: {
  options: JourneyOptions;
  onChange: (next: JourneyOptions) => void;
}) {
  const count = countJourneyOptions(options);
  const toggleMode = (mode: (typeof EXCLUDABLE_MODES)[number]) => {
    const exclude = options.exclude.includes(mode)
      ? options.exclude.filter((m) => m !== mode)
      : [...options.exclude, mode];
    // mindestens ein Verkehrsmittel bleibt erlaubt
    if (exclude.length < EXCLUDABLE_MODES.length) onChange({ ...options, exclude });
  };

  return (
    <BottomSheet
      title="Optionen"
      description="Verkehrsmittel, Umstiege und Barrierefreiheit"
      triggerLabel={count > 0 ? `Optionen (${count} aktiv)` : "Optionen"}
      triggerClassName={cn(CHIP_BASE, "h-8 px-2.5", count > 0 ? CHIP_ON : CHIP_OFF)}
      trigger={
        <>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {count > 0 && <span aria-hidden="true">{count}</span>}
        </>
      }
    >
      <div className="space-y-5">
        <Group label="Verkehrsmittel">
          {EXCLUDABLE_MODES.map((mode) => (
            <Chip
              key={mode}
              active={!options.exclude.includes(mode)}
              label={`${MODE_LABEL[mode]} nutzen`}
              onClick={() => toggleMode(mode)}
            >
              {MODE_LABEL[mode]}
            </Chip>
          ))}
        </Group>
        <Group label="Umstiege">
          {TRANSFER_CHOICES.map((choice) => (
            <Chip
              key={choice.label}
              active={options.maxTransfers === choice.value}
              onClick={() => onChange({ ...options, maxTransfers: choice.value })}
            >
              {choice.label}
            </Chip>
          ))}
        </Group>
        <Group label="Umstiegszeit">
          {SPEED_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              active={options.transferSpeed === choice.value}
              onClick={() => onChange({ ...options, transferSpeed: choice.value })}
            >
              {choice.label}
            </Chip>
          ))}
        </Group>
        <Group label="Barrierefreiheit">
          <Chip
            active={options.accessible}
            onClick={() => onChange({ ...options, accessible: !options.accessible })}
          >
            Stufenfrei
          </Chip>
        </Group>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_JOURNEY_OPTIONS)}>
            Zurücksetzen
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
