// Mehrere eigene Zwischenhalte (#110): Etappen nacheinander suchen. Jede Etappe ist eine normale
// Verbindungssuche (beste Quelle je Etappe, eigener Cache) ab der Ankunft der vorigen Etappe plus
// Aufenthalt. Oben die Gesamtroute, darunter jede Etappe mit Auswahl einer anderen Verbindung.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { JourneyList } from "@/components/journey-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchJourneys } from "@/lib/api";
import { formatDuration, type PickedStop } from "@/lib/journeys";
import { arrivalOf, departureOf, nextLegStart } from "@/lib/legs";
import { formatClock } from "@/lib/time";
import type { Journey } from "../../shared/api-types";
import type { JourneyOptions } from "../../shared/journey-options";

export interface Leg {
  from: PickedStop;
  to: PickedStop;
  /** Aufenthalt am Start der Etappe (Minuten) */
  stay: number;
}

function clock(ms: number): string {
  return Number.isNaN(ms) ? "–" : formatClock(new Date(ms));
}

function LegSection({
  legs,
  index,
  when,
  options,
  choices,
  onChoose,
  onResolved,
}: {
  legs: readonly Leg[];
  index: number;
  /** Start dieser Etappe (ISO), fehlt = jetzt */
  when: string | undefined;
  options: JourneyOptions;
  choices: readonly number[];
  onChoose: (index: number, choice: number) => void;
  onResolved: (index: number, journey: Journey | null) => void;
}) {
  const leg = legs[index]!;
  const [showAll, setShowAll] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["journeys", leg.from.id, leg.to.id, when ?? "now", false, options],
    queryFn: ({ signal }) =>
      fetchJourneys({ from: leg.from.id, to: leg.to.id, when, arrive: false, options }, signal),
    staleTime: 60_000,
  });
  const journeys = data?.journeys ?? [];
  const choice = Math.min(choices[index] ?? 0, Math.max(0, journeys.length - 1));
  const chosen = journeys[choice] ?? null;
  const chosenId = chosen?.id ?? null;

  // Gewählte Verbindung nach oben melden (für die Gesamtroute)
  useEffect(() => {
    onResolved(index, chosen);
    // nur bei Wechsel der gewählten Verbindung
    // oxlint-disable-next-line react/exhaustive-deps
  }, [index, chosenId]);

  const last = index === legs.length - 1;
  const next = chosen ? nextLegStart(chosen, legs[index + 1]?.stay ?? 0) : undefined;

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-baseline gap-2 border-b px-3 py-2">
          <span className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
            Etappe {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {leg.from.name} → {leg.to.name}
          </span>
          {leg.stay > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">nach {leg.stay} Min</span>
          )}
        </div>
        {isPending && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Etappe wird gesucht …
          </p>
        )}
        {isError && (
          <div role="alert" className="flex flex-col items-center gap-2 py-5 text-sm">
            <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
            <p>Diese Etappe konnte nicht geladen werden.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Erneut versuchen
            </Button>
          </div>
        )}
        {data && !chosen && (
          <p role="status" className="py-5 text-center text-sm text-muted-foreground">
            Keine Verbindung für diese Etappe gefunden.
          </p>
        )}
        {chosen && <JourneyList journeys={[chosen]} />}
        {journeys.length > 1 && (
          <div className="border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 text-blue-600 dark:text-blue-400"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
            >
              Andere Verbindung
            </Button>
            {showAll && (
              <div
                role="group"
                aria-label="Verbindung wählen"
                className="flex flex-wrap gap-1.5 pt-1"
              >
                {journeys.map((journey, i) => (
                  <button
                    key={journey.id}
                    type="button"
                    aria-pressed={i === choice}
                    onClick={() => onChoose(index, i)}
                    className={cn(
                      "h-8 rounded-full px-3 text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === choice
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "bg-muted text-foreground hover:bg-accent",
                    )}
                  >
                    {clock(departureOf(journey))} → {clock(arrivalOf(journey))}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      {!last && chosen && (
        <LegSection
          legs={legs}
          index={index + 1}
          when={next}
          options={options}
          choices={choices}
          onChoose={onChoose}
          onResolved={onResolved}
        />
      )}
    </>
  );
}

/** Gesamtroute oben, darunter die Etappen nacheinander */
export function LegJourneys({
  legs,
  time,
  arrive,
  options,
}: {
  legs: readonly Leg[];
  time: string | undefined;
  arrive: boolean;
  options: JourneyOptions;
}) {
  const [choices, setChoices] = useState<number[]>([]);
  const [resolved, setResolved] = useState<(Journey | null)[]>([]);
  const onChoose = (index: number, choice: number) =>
    setChoices((prev) => {
      const next = [...prev];
      next[index] = choice;
      // spätere Etappen rechnen neu, beginnend mit ihrer ersten Verbindung
      return next.slice(0, index + 1);
    });
  const onResolved = (index: number, journey: Journey | null) =>
    setResolved((prev) => {
      const next = prev.slice(0, legs.length);
      next[index] = journey;
      return next;
    });

  const all = legs.map((_, i) => resolved[i] ?? null);
  const complete = all.every((j) => j !== null);
  const first = all[0];
  const final = all.at(-1);
  const total =
    complete && first && final
      ? Math.round((arrivalOf(final) - departureOf(first)) / 60_000)
      : null;

  return (
    <div className="space-y-3">
      {arrive && (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          Bei mehreren Zwischenhalten gilt die Zeit als Abfahrt.
        </p>
      )}
      <Card aria-label="Gesamtroute" className="gap-1 px-3 py-2.5">
        <p className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {first ? clock(departureOf(first)) : "…"} →{" "}
            {complete && final ? clock(arrivalOf(final)) : "…"}
          </span>
          <span className="text-sm text-muted-foreground">
            {total !== null ? `${formatDuration(total)} · ` : ""}
            {legs.length} Etappen
          </span>
        </p>
        <ol aria-label="Halte" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
          {legs.map((leg, i) => (
            <li key={`${leg.from.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <Flag className="size-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              )}
              <span className={cn(i === 0 && "font-medium")}>{leg.from.name}</span>
              {i > 0 && leg.stay > 0 && (
                <span className="text-muted-foreground">({leg.stay} Min)</span>
              )}
              <span className="text-muted-foreground" aria-hidden="true">
                →
              </span>
            </li>
          ))}
          <li className="font-medium">{legs.at(-1)?.to.name}</li>
        </ol>
      </Card>
      <LegSection
        legs={legs}
        index={0}
        when={time}
        options={options}
        choices={choices}
        onChoose={onChoose}
        onResolved={onResolved}
      />
    </div>
  );
}
