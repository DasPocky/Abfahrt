import { useId, useState } from "react";
import { Clock, SlidersHorizontal, X } from "lucide-react";
import { ModeIcon } from "@/components/mode-icon";
import { Button } from "@/components/ui/button";
import {
  availableLines,
  availableModes,
  availablePlatforms,
  type DepartureFilter,
  toggle,
} from "@/lib/filters";
import { MODE_LABEL } from "@/lib/modes";
import { cn } from "@/lib/utils";
import type { Departure } from "../../shared/api-types";

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
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-accent hover:text-accent-foreground",
      )}
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

export function FilterBar({
  departures,
  filter,
  onChange,
}: {
  departures: readonly Departure[];
  filter: DepartureFilter;
  onChange: (filter: DepartureFilter) => void;
}) {
  const [expanded, setExpanded] = useState(
    filter.lines.length > 0 || filter.platforms.length > 0 || filter.time !== undefined,
  );
  const panelId = useId();
  const timeId = useId();
  // Auswahl auch zeigen, wenn sie gerade nicht in den Abfahrten vorkommt
  const modes = [...new Set([...availableModes(departures), ...filter.modes])];
  const lines = [...new Set([...availableLines(departures, filter.modes), ...filter.lines])];
  const platforms = [
    ...new Set([...availablePlatforms(departures, filter.modes), ...filter.platforms]),
  ];
  const moreCount = filter.lines.length + filter.platforms.length + (filter.time ? 1 : 0);

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Verkehrsmittel filtern"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        <Chip active={filter.modes.length === 0} onClick={() => onChange({ ...filter, modes: [] })}>
          Alle
        </Chip>
        {modes.map((mode) => (
          <Chip
            key={mode}
            active={filter.modes.includes(mode)}
            onClick={() =>
              onChange({ ...filter, modes: toggle(filter.modes, mode), lines: [], platforms: [] })
            }
          >
            <ModeIcon mode={mode} className="size-4" aria-hidden="true" />
            {MODE_LABEL[mode]}
          </Chip>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 rounded-full"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Mehr{moreCount > 0 ? ` (${moreCount})` : ""}
        </Button>
      </div>

      {expanded && (
        <div id={panelId} className="space-y-3 rounded-xl border p-3">
          {lines.length > 0 && (
            <div role="group" aria-label="Linien filtern" className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Linien</p>
              <div className="flex flex-wrap gap-2">
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
            <div role="group" aria-label="Gleis oder Steig filtern" className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Gleis / Steig</p>
              <div className="flex flex-wrap gap-2">
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
          <div className="space-y-1.5">
            <label htmlFor={timeId} className="text-xs font-medium text-muted-foreground">
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
                  const { time: _time, ...rest } = filter;
                  onChange(value ? { ...rest, time: new Date(value).toISOString() } : rest);
                }}
              />
              {filter.time && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const { time: _time, ...rest } = filter;
                    onChange(rest);
                  }}
                >
                  <X aria-hidden="true" />
                  Jetzt
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
