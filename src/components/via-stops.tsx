// Eigene Zwischenhalte im Von/Nach-Kasten (#110): Suche, Aufenthalt, Reihenfolge, Entfernen.
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { StopPicker } from "@/components/stop-picker";
import { Button } from "@/components/ui/button";
import type { LocationState } from "@/hooks/use-location";
import { MAX_VIAS, VIA_STAY_CHOICES, type PickedStop, type ViaStop } from "@/lib/journeys";

function move<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Eine Zeile je Zwischenhalt; leere Zeilen (noch ohne Haltestelle) stehen als `null` */
export function ViaStopRows({
  vias,
  location,
  onChange,
}: {
  vias: readonly (ViaStop | null)[];
  location: LocationState;
  onChange: (vias: (ViaStop | null)[]) => void;
}) {
  return (
    <>
      {vias.map((via, index) => {
        const label = `Zwischenhalt ${index + 1}`;
        const value: PickedStop | null = via && { id: via.id, name: via.name };
        return (
          // Zeilen haben keine stabile ID, die Position ist die Identität
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index} role="group" aria-label={label} className="border-t">
            <div className="flex items-center gap-1 pr-1">
              <div className="min-w-0 flex-1">
                <StopPicker
                  label={label}
                  placeholder={`${label}: Haltestelle`}
                  value={value}
                  location={location}
                  stopsOnly
                  onSelect={(stop) => {
                    const next = [...vias];
                    next[index] = { ...stop, minutes: via?.minutes ?? 0 };
                    onChange(next);
                  }}
                />
              </div>
              <label className="sr-only" htmlFor={`via-stay-${index}`}>
                Aufenthalt an {label}
              </label>
              <select
                id={`via-stay-${index}`}
                className="h-8 rounded-md border bg-background px-1 text-xs dark:bg-input/30"
                value={via?.minutes ?? 0}
                disabled={via === null}
                onChange={(event) => {
                  if (!via) return;
                  const next = [...vias];
                  next[index] = { ...via, minutes: Number(event.target.value) };
                  onChange(next);
                }}
              >
                {VIA_STAY_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? "kein Halt" : `${minutes} Min`}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} nach oben`}
                disabled={index === 0}
                onClick={() => onChange(move(vias, index, -1))}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} nach unten`}
                disabled={index === vias.length - 1}
                onClick={() => onChange(move(vias, index, 1))}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} entfernen`}
                onClick={() => onChange(vias.filter((_, i) => i !== index))}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** „+ Zwischenhalt“ unter dem Kasten; ab MAX_VIAS ausgeblendet */
export function AddViaButton({ count, onAdd }: { count: number; onAdd: () => void }) {
  if (count >= MAX_VIAS) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        Höchstens {MAX_VIAS} Zwischenhalte, damit die Suche schnell bleibt.
      </p>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-blue-600 dark:text-blue-400"
      onClick={onAdd}
    >
      <Plus aria-hidden="true" />
      Zwischenhalt
    </Button>
  );
}
