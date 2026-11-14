import { useId } from "react";
import { Clock, SlidersHorizontal, X } from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  availableLines,
  availableModes,
  availablePlatforms,
  type DepartureFilter,
  toggle,
} from "@/lib/filters";
import { MODE_LABEL, MODE_SHORT } from "@/lib/modes";
import type { Departure } from "../../shared/api-types";

const CHIP_BASE =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const CHIP_ON = "bg-foreground text-background";
const CHIP_OFF = "bg-muted text-foreground hover:bg-accent";

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
    >
      {children}
    </button>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** <input type="datetime-local"> erwartet lokale Zeit ohne Zone */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function withoutTime(filter: DepartureFilter): DepartureFilter {
  const { time: _time, ...rest } = filter;
  return rest;
}

export function FilterBar({
  departures,
  filter,
  onChange,
}: {
  departures: readonly Departure[];
  filter: DepartureFilter;
  onChange: (filter: DepartureFilter) => void;
}) {
  const timeId = useId();
  // Auswahl auch zeigen, wenn sie gerade nicht in den Abfahrten vorkommt
  const modes = [...new Set([...availableModes(departures), ...filter.modes])];
  const lines = [...new Set([...availableLines(departures, filter.modes), ...filter.lines])];
  const platforms = [
    ...new Set([...availablePlatforms(departures, filter.modes), ...filter.platforms]),
  ];
  const moreCount = filter.lines.length + filter.platforms.length + (filter.time ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Verkehrsmittel filtern"
        className="-ml-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 pl-4 [scrollbar-width:none]"
      >
        <Chip active={filter.modes.length === 0} onClick={() => onChange({ ...filter, modes: [] })}>
          Alle
        </Chip>
        {modes.map((mode) => (
          <Chip
            key={mode}
            active={filter.modes.includes(mode)}
            label={MODE_LABEL[mode]}
            onClick={() =>
              onChange({ ...filter, modes: toggle(filter.modes, mode), lines: [], platforms: [] })
            }
          >
            {MODE_SHORT[mode]}
          </Chip>
        ))}
      </div>

      <BottomSheet
        title="Filter"
        description="Linien, Gleis/Steig und Zeitpunkt"
        triggerLabel={moreCount > 0 ? `Weitere Filter (${moreCount} aktiv)` : "Weitere Filter"}
        triggerClassName={cn(CHIP_BASE, "relative px-2.5", moreCount > 0 ? CHIP_ON : CHIP_OFF)}
        trigger={
          <>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {moreCount > 0 && <span aria-hidden="true">{moreCount}</span>}
          </>
        }
      >
        <div className="space-y-5">
          {lines.length > 0 && (
            <div role="group" aria-label="Linien filtern" className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Linien
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lines.map((line) => (
                  <Chip
                    key={line}
                    active={filter.lines.includes(line)}
                    label={`Linie ${line}`}
                    onClick={() => onChange({ ...filter, lines: toggle(filter.lines, line) })}
                  >
                    {line}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {platforms.length > 0 && (
            <div role="group" aria-label="Gleis oder Steig filtern" className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Gleis / Steig
              </p>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((platform) => (
                  <Chip
                    key={platform}
                    active={filter.platforms.includes(platform)}
                    label={`Gleis ${platform}`}
                    onClick={() =>
                      onChange({ ...filter, platforms: toggle(filter.platforms, platform) })
                    }
                  >
                    {platform}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label
              htmlFor={timeId}
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Abfahrten ab
            </label>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              <input
                id={timeId}
                type="datetime-local"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                value={filter.time ? toLocalInput(filter.time) : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange(
                    value
                      ? { ...withoutTime(filter), time: new Date(value).toISOString() }
                      : withoutTime(filter),
                  );
                }}
              />
              {filter.time && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(withoutTime(filter))}
                >
                  <X aria-hidden="true" />
                  Jetzt
                </Button>
              )}
            </div>
          </div>
          {moreCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...withoutTime(filter), lines: [], platforms: [] })}
            >
              Zusätzliche Filter zurücksetzen
            </Button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
