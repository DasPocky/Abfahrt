import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { Chip, CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { countJourneyOptions } from "@/lib/journeys";
import { MODE_LABEL } from "@/lib/modes";
import { StopPicker } from "@/components/stop-picker";
import type { LocationState } from "@/hooks/use-location";
import type { PickedStop } from "@/lib/journeys";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  type JourneyOptions,
  type RoutePreference,
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

const ROUTE_CHOICES: { value: RoutePreference; label: string }[] = [
  { value: "fastest", label: "Schnellste" },
  { value: "fewTransfers", label: "Wenige Umstiege" },
  { value: "lessWalking", label: "Wenig Fußweg" },
];

/** Aufenthalt am Zwischenhalt (Minuten) */
const VIA_STAY_CHOICES = [0, 5, 10, 15, 30, 60] as const;

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  /** kleiner Hinweis unter den Chips, z. B. „nur im VRR-Gebiet“ */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Optionen-Knopf mit Panel (#101): Route, Verkehrsmittel, Umstiege, Umstiegszeit, über einen Halt,
 * Barrierefreiheit, Fahrrad und Haltestellen in der Nähe – alles, was der VRR anbietet.
 */
export function JourneyOptionsSheet({
  options,
  viaName,
  location,
  onChange,
}: {
  options: JourneyOptions;
  /** Anzeigename des Zwischenhalts */
  viaName: string | undefined;
  location: LocationState;
  /** `viaName` nur, wenn sich der Zwischenhalt ändert */
  onChange: (next: JourneyOptions, viaName?: string) => void;
}) {
  const flip = (
    key: "accessible" | "noStairs" | "noEscalators" | "lowFloor" | "bike" | "nearbyStops",
  ) => onChange({ ...options, [key]: !options[key] });
  const via: PickedStop | null = options.via ? { id: options.via, name: viaName ?? "" } : null;
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
      description="Route, Verkehrsmittel, Umstiege, Zwischenhalt und Barrierefreiheit"
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
        <Group label="Route" hint="„Wenig Fußweg“ bevorzugt Umstiege am selben Steig (VRR-Gebiet)">
          {ROUTE_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              active={options.route === choice.value}
              onClick={() => onChange({ ...options, route: choice.value })}
            >
              {choice.label}
            </Chip>
          ))}
        </Group>
        <Group label="Verkehrsmittel" hint="Deutschlandticket: Fernzug abwählen">
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
        <div role="group" aria-label="Über" className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Über
          </p>
          <div className="flex items-center gap-2 rounded-md border">
            <div className="min-w-0 flex-1">
              <StopPicker
                label="Über"
                placeholder="Zwischenhalt (optional)"
                value={via}
                location={location}
                stopsOnly
                onSelect={(stop) => onChange({ ...options, via: stop.id }, stop.name)}
              />
            </div>
            {via && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zwischenhalt entfernen"
                onClick={() => onChange({ ...options, via: null, viaMinutes: 0 }, "")}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
          {via && (
            <div role="group" aria-label="Aufenthalt" className="flex flex-wrap gap-1.5">
              {VIA_STAY_CHOICES.map((minutes) => (
                <Chip
                  key={minutes}
                  active={options.viaMinutes === minutes}
                  onClick={() => onChange({ ...options, viaMinutes: minutes })}
                >
                  {minutes === 0 ? "Ohne Aufenthalt" : `${minutes} Min`}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <Group label="Barrierefreiheit">
          <Chip active={options.accessible} onClick={() => flip("accessible")}>
            Rollstuhl
          </Chip>
          <Chip active={options.accessible || options.noStairs} onClick={() => flip("noStairs")}>
            Ohne Treppen
          </Chip>
          <Chip
            active={options.accessible || options.noEscalators}
            onClick={() => flip("noEscalators")}
          >
            Ohne Rolltreppen
          </Chip>
          <Chip active={options.accessible || options.lowFloor} onClick={() => flip("lowFloor")}>
            Niederflur
          </Chip>
        </Group>
        <Group label="Weiteres" hint="Fahrrad und Umgebung wirken im VRR-Gebiet">
          <Chip active={options.bike} onClick={() => flip("bike")}>
            Fahrrad mitnehmen
          </Chip>
          <Chip active={options.nearbyStops} onClick={() => flip("nearbyStops")}>
            Haltestellen in der Nähe
          </Chip>
        </Group>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_JOURNEY_OPTIONS, "")}>
            Zurücksetzen
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
