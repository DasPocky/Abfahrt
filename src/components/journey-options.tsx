import {
  Accessibility,
  ArrowLeftRight,
  Bike,
  Check,
  Info,
  RotateCcw,
  Route,
  SlidersHorizontal,
  Timer,
  TramFront,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/chip";
import { ModeIcon } from "@/components/mode-icon";
import { ACCENT_ON, Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { countJourneyOptions } from "@/lib/journeys";
import { MODE_BADGE_CLASS } from "@/lib/line-colors";
import { MODE_LABEL } from "@/lib/modes";
import type { TransportMode } from "../../shared/api-types";
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

/** Abschnitt mit Symbol, Überschrift und optionalem Hinweis */
function Section({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** kleiner Hinweis darunter, z. B. „nur im VRR-Gebiet“ */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section role="group" aria-label={label} className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </p>
      {children}
      {hint && (
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
    </section>
  );
}

/** An/Aus-Option: aktiv blau mit Häkchen */
function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(CHIP_BASE, active ? ACCENT_ON : CHIP_OFF)}
    >
      {active && <Check className="size-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Verkehrsmittel in seiner Linienfarbe; abgewählt grau und durchgestrichen */
function ModeToggle({
  mode,
  active,
  onClick,
}: {
  mode: TransportMode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${MODE_LABEL[mode]} nutzen`}
      onClick={onClick}
      className={cn(
        CHIP_BASE,
        active ? MODE_BADGE_CLASS[mode] : "bg-muted text-muted-foreground line-through opacity-70",
      )}
    >
      <ModeIcon mode={mode} className="size-4" aria-hidden="true" />
      {MODE_LABEL[mode]}
    </button>
  );
}

/**
 * Optionen-Knopf mit Panel (#101): Route, Verkehrsmittel, Umstiege, Umstiegszeit, Barrierefreiheit,
 * Fahrrad und Haltestellen in der Nähe. Zwischenhalte stehen direkt im Von/Nach-Kasten (#110).
 */
export function JourneyOptionsSheet({
  options,
  onChange,
}: {
  options: JourneyOptions;
  onChange: (next: JourneyOptions) => void;
}) {
  const flip = (
    key: "accessible" | "noStairs" | "noEscalators" | "lowFloor" | "bike" | "nearbyStops",
  ) => onChange({ ...options, [key]: !options[key] });
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
      description="Route, Verkehrsmittel, Umstiege und Barrierefreiheit"
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
        <Section
          icon={Route}
          label="Route"
          hint="„Wenig Fußweg“ bevorzugt Umstiege am selben Steig (VRR-Gebiet)"
        >
          <Segmented
            choices={ROUTE_CHOICES}
            value={options.route}
            onChange={(route) => onChange({ ...options, route })}
          />
        </Section>
        <Section icon={TramFront} label="Verkehrsmittel" hint="Deutschlandticket: Fernzug abwählen">
          <div className="flex flex-wrap gap-1.5">
            {EXCLUDABLE_MODES.map((mode) => (
              <ModeToggle
                key={mode}
                mode={mode}
                active={!options.exclude.includes(mode)}
                onClick={() => toggleMode(mode)}
              />
            ))}
          </div>
        </Section>
        <Section icon={ArrowLeftRight} label="Umstiege">
          <Segmented
            choices={TRANSFER_CHOICES}
            value={options.maxTransfers}
            onChange={(maxTransfers) => onChange({ ...options, maxTransfers })}
          />
        </Section>
        <Section icon={Timer} label="Umstiegszeit">
          <Segmented
            choices={SPEED_CHOICES}
            value={options.transferSpeed}
            onChange={(transferSpeed) => onChange({ ...options, transferSpeed })}
          />
        </Section>
        <Section icon={Accessibility} label="Barrierefreiheit">
          <div className="flex flex-wrap gap-1.5">
            <Toggle active={options.accessible} onClick={() => flip("accessible")}>
              Rollstuhl
            </Toggle>
            <Toggle
              active={options.accessible || options.noStairs}
              onClick={() => flip("noStairs")}
            >
              Ohne Treppen
            </Toggle>
            <Toggle
              active={options.accessible || options.noEscalators}
              onClick={() => flip("noEscalators")}
            >
              Ohne Rolltreppen
            </Toggle>
            <Toggle
              active={options.accessible || options.lowFloor}
              onClick={() => flip("lowFloor")}
            >
              Niederflur
            </Toggle>
          </div>
        </Section>
        <Section icon={Bike} label="Weiteres" hint="Fahrrad und Umgebung wirken im VRR-Gebiet">
          <div className="flex flex-wrap gap-1.5">
            <Toggle active={options.bike} onClick={() => flip("bike")}>
              Fahrrad mitnehmen
            </Toggle>
            <Toggle active={options.nearbyStops} onClick={() => flip("nearbyStops")}>
              Haltestellen in der Nähe
            </Toggle>
          </div>
        </Section>
        {count > 0 && (
          <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_JOURNEY_OPTIONS)}>
            <RotateCcw aria-hidden="true" />
            Zurücksetzen
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
