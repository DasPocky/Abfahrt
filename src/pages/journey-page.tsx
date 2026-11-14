import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { cn } from "cn";
import { JourneyList } from "@/components/journey-list";
import { SourceAttribution } from "@/components/source-attribution";
import { StopPicker } from "@/components/stop-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError, fetchJourneys, nearbyStops, roundCoord } from "@/lib/api";
import { distanceKm } from "@/lib/geo";
import {
  type JourneyQuery,
  type PickedStop,
  journeyQueryFromParams,
  journeyQueryToParams,
  swapJourneyQuery,
} from "@/lib/journeys";
import { toLocalInputValue } from "@/lib/time";

type Slot = "from" | "to";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return "Start oder Ziel wurde nicht gefunden.";
    if (error.code === "invalid_when") return "Der gewählte Zeitpunkt ist ungültig.";
    if (error.status === 400) return "Start oder Ziel ist ungültig.";
  }
  return "Verbindungen konnten gerade nicht geladen werden.";
}

const SEGMENT_CLASS =
  "h-7 rounded px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs text-muted-foreground hover:text-foreground dark:aria-pressed:bg-input/50";

export function JourneyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = journeyQueryFromParams(searchParams);
  const update = (next: JourneyQuery) =>
    setSearchParams(journeyQueryToParams(next), { replace: true });
  const location = useLocation();
  const queryClient = useQueryClient();
  const now = useNow(30_000);

  // „Mein Standort“: wartet ggf. auf die Position, dann nächste Haltestelle übernehmen
  const [pending, setPending] = useState<Slot | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  function pickLocation(slot: Slot) {
    setLocationError(null);
    setPending(slot);
    if (location.status !== "on" && location.status !== "locating") location.toggle();
  }

  const { status: locationStatus, position } = location;
  const locationFailed =
    pending !== null && (locationStatus === "denied" || locationStatus === "unavailable");
  const locationMessage =
    locationError ??
    (locationFailed
      ? locationStatus === "denied"
        ? "Standort nicht freigegeben (Browser-Einstellungen)."
        : "Standort gerade nicht verfügbar."
      : null);
  useEffect(() => {
    if (pending === null || locationFailed || position === null) return undefined;
    let cancelled = false;
    const lat = roundCoord(position.lat);
    const lon = roundCoord(position.lon);
    queryClient
      .fetchQuery({
        // gleicher Schlüssel wie „In der Nähe“ auf der Startseite
        queryKey: ["stops", "nearby", lat, lon],
        queryFn: ({ signal }) => nearbyStops(Number(lat), Number(lon), signal),
        staleTime: 10 * 60_000,
      })
      .then(
        ({ stops }) => {
          if (cancelled) return;
          const nearest = stops
            .filter((s) => s.lat !== undefined && s.lon !== undefined)
            .map((stop) => ({
              stop,
              km: distanceKm(position, { lat: stop.lat ?? 0, lon: stop.lon ?? 0 }),
            }))
            .toSorted((a, b) => a.km - b.km)[0]?.stop;
          setPending(null);
          if (!nearest) {
            setLocationError("Keine Haltestelle im Umkreis von 1 km.");
            return;
          }
          setSearchParams(
            (current) => {
              const q = journeyQueryFromParams(current);
              return journeyQueryToParams({
                ...q,
                [pending]: { id: nearest.id, name: nearest.name },
              });
            },
            { replace: true },
          );
        },
        () => {
          if (cancelled) return;
          setPending(null);
          setLocationError("Haltestellen in der Nähe gerade nicht verfügbar.");
        },
      );
    return () => {
      cancelled = true;
    };
  }, [pending, locationFailed, position, queryClient, setSearchParams]);

  const { from, to } = query;
  const sameStop = from !== null && to !== null && from.id === to.id;
  const ready = from !== null && to !== null && !sameStop;

  const { data, error, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ["journeys", from?.id, to?.id, query.time ?? "now", query.arrive],
    queryFn: ({ signal }) =>
      fetchJourneys(
        { from: from?.id ?? "", to: to?.id ?? "", when: query.time, arrive: query.arrive },
        signal,
      ),
    enabled: ready,
    staleTime: 60_000,
    // Bei „Früher“/„Später“ bleibt die alte Liste stehen, bis die neue da ist
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === from?.id && previousQuery?.queryKey[2] === to?.id
        ? previous
        : undefined,
  });

  // Namen aus der Antwort ergänzen, falls der Link nur IDs enthält
  const fromStop: PickedStop | null = from && {
    id: from.id,
    name: from.name || (data?.from.id === from.id ? data.from.name : "") || from.id,
  };
  const toStop: PickedStop | null = to && {
    id: to.id,
    name: to.name || (data?.to.id === to.id ? data.to.name : "") || to.id,
  };

  const shift = (when: string) => update({ ...query, time: when, arrive: false });

  return (
    <section aria-labelledby="journey-title" className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
        <Link to="/" aria-label="Zurück zur Suche">
          <ArrowLeft aria-hidden="true" />
          Suche
        </Link>
      </Button>

      <h1 id="journey-title" className="text-xl font-semibold tracking-tight">
        Verbindung suchen
      </h1>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <StopPicker
              label="Von"
              placeholder="Start"
              value={fromStop}
              location={location}
              locating={pending === "from" && !locationFailed}
              onSelect={(stop) => update({ ...query, from: stop })}
              onPickLocation={() => pickLocation("from")}
            />
            <StopPicker
              label="Nach"
              placeholder="Ziel"
              value={toStop}
              location={location}
              locating={pending === "to" && !locationFailed}
              onSelect={(stop) => update({ ...query, to: stop })}
              onPickLocation={() => pickLocation("to")}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Start und Ziel tauschen"
            title="Start und Ziel tauschen"
            className="text-muted-foreground"
            disabled={from === null && to === null}
            onClick={() => update(swapJourneyQuery({ ...query, from: fromStop, to: toStop }))}
          >
            <ArrowUpDown aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Zeitpunkt gilt für"
            className="flex shrink-0 rounded-md border bg-muted p-0.5"
          >
            <button
              type="button"
              className={SEGMENT_CLASS}
              aria-pressed={!query.arrive}
              onClick={() => update({ ...query, arrive: false })}
            >
              Abfahrt
            </button>
            <button
              type="button"
              className={SEGMENT_CLASS}
              aria-pressed={query.arrive}
              // Ankunft braucht einen Zeitpunkt: ohne Auswahl gilt die aktuelle Uhrzeit
              onClick={() =>
                update({ ...query, arrive: true, time: query.time ?? new Date().toISOString() })
              }
            >
              Ankunft
            </button>
          </div>
          <label htmlFor="journey-time" className="sr-only">
            Datum und Uhrzeit
          </label>
          <input
            id="journey-time"
            type="datetime-local"
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm dark:bg-input/30"
            value={toLocalInputValue(query.time ?? now.toISOString())}
            onChange={(event) => {
              const value = event.target.value;
              update(
                value
                  ? { ...query, time: new Date(value).toISOString() }
                  : { ...query, time: undefined, arrive: false },
              );
            }}
          />
          {query.time && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => update({ ...query, time: undefined, arrive: false })}
            >
              Jetzt
            </Button>
          )}
        </div>
      </div>

      {locationMessage && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {locationMessage}
        </p>
      )}

      {sameStop && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          Start und Ziel sind gleich.
        </p>
      )}

      {!ready && !sameStop && (
        <p className="px-1 text-sm text-muted-foreground">
          Start und Ziel wählen, die Verbindungen erscheinen dann hier.
        </p>
      )}

      {ready && (
        <Card className="gap-0 overflow-hidden py-0">
          {isPending && (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Verbindungen werden gesucht …
            </p>
          )}
          {isError && !data && (
            <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm">
              <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
              <p>{errorMessage(error)}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Erneut versuchen
              </Button>
            </div>
          )}
          {data && (
            <div aria-busy={isPlaceholderData || undefined}>
              {data.earlier !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full rounded-none border-b text-muted-foreground"
                  disabled={isFetching}
                  onClick={() => data.earlier && shift(data.earlier)}
                >
                  <ChevronUp aria-hidden="true" />
                  Früher
                </Button>
              )}
              {data.journeys.length === 0 ? (
                <p role="status" className="py-6 text-center text-sm text-muted-foreground">
                  Keine Verbindung gefunden.
                </p>
              ) : (
                <div className={cn(isPlaceholderData && "opacity-60")}>
                  <JourneyList journeys={data.journeys} />
                </div>
              )}
              {data.later !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full rounded-none border-t text-muted-foreground"
                  disabled={isFetching}
                  onClick={() => data.later && shift(data.later)}
                >
                  <ChevronDown aria-hidden="true" />
                  Später
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {isError && data && (
        <p role="status" className="text-xs text-warning">
          Abfrage fehlgeschlagen, angezeigt wird der letzte Stand.
        </p>
      )}

      {data && ready && <SourceAttribution source={data.source} />}
    </section>
  );
}
