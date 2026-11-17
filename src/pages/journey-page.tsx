import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowUpDown, ChevronDown, ChevronUp, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { JourneyList } from "@/components/journey-list";
import { LegJourneys } from "@/components/leg-journeys";
import { JourneyOptionsSheet } from "@/components/journey-options";
import { JourneyTimeSheet } from "@/components/journey-time";
import { SourceAttribution } from "@/components/source-attribution";
import { StopPicker } from "@/components/stop-picker";
import { AddViaButton, ViaStopRows } from "@/components/via-stops";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError, fetchJourneys, nearbyStops, roundCoord } from "@/lib/api";
import { distanceKm } from "@/lib/geo";
import {
  type JourneyQuery,
  type PickedStop,
  type ViaStop,
  apiOptions,
  describeJourneyOptions,
  journeyLegs,
  MAX_VIAS,
  journeyQueryFromParams,
  journeyQueryToParams,
  swapJourneyQuery,
} from "@/lib/journeys";
import { stopLabel } from "@/lib/stop-label";
import { LocationHelp } from "@/components/location-help";
import { useSavedTrip } from "@/hooks/use-saved-trip";
import { journeySignature, setSavedTrip } from "@/lib/saved-trip";

type Slot = "from" | "to";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) return "Start oder Ziel wurde nicht gefunden.";
    if (error.code === "invalid_when") return "Der gewählte Zeitpunkt ist ungültig.";
    if (error.code === "invalid_options") return "Die gewählten Optionen sind ungültig.";
    if (error.status === 400) return "Start oder Ziel ist ungültig.";
  }
  return "Verbindungen konnten gerade nicht geladen werden.";
}

export function JourneyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = journeyQueryFromParams(searchParams);
  const update = (next: JourneyQuery) =>
    setSearchParams(journeyQueryToParams(next), { replace: true });
  const location = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const savedTrip = useSavedTrip();
  const now = useNow(30_000);

  // „Mein Standort“: wartet ggf. auf die Position, dann nächste Haltestelle übernehmen
  const [pending, setPending] = useState<Slot | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Neue, noch leere Zwischenhalt-Zeilen (gewählte stehen in der URL)
  const [emptyVias, setEmptyVias] = useState(0);
  const viaRows: (ViaStop | null)[] = [
    ...query.vias,
    ...Array.from(
      { length: Math.max(0, Math.min(emptyVias, MAX_VIAS - query.vias.length)) },
      () => null,
    ),
  ];

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
        ? "Standort nicht freigegeben."
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
                [pending]: { id: nearest.id, name: stopLabel(nearest) },
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
  // Mehrere Zwischenhalte: Etappen-Suche statt einer Abfrage (#110)
  const legs = query.vias.length >= 2 ? journeyLegs(query) : [];
  const options = apiOptions(query);

  const { data, error, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ["journeys", from?.id, to?.id, query.time ?? "now", query.arrive, options],
    queryFn: ({ signal }) =>
      fetchJourneys(
        {
          from: from?.id ?? "",
          to: to?.id ?? "",
          when: query.time,
          arrive: query.arrive,
          options,
        },
        signal,
      ),
    enabled: ready && legs.length === 0,
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
    name: from.name || (data?.from.id === from.id ? stopLabel(data.from) : "") || from.id,
  };
  const toStop: PickedStop | null = to && {
    id: to.id,
    name: to.name || (data?.to.id === to.id ? stopLabel(data.to) : "") || to.id,
  };

  const optionsSummary = describeJourneyOptions(query.options);
  const shift = (when: string) => update({ ...query, time: when, arrive: false });

  return (
    <section aria-labelledby="journey-title" className="space-y-3">
      <h1 id="journey-title" className="text-2xl font-semibold tracking-tight">
        Verbindung
      </h1>

      <div className="space-y-2">
        <div className="relative rounded-xl border bg-card">
          <StopPicker
            label="Von"
            marker="start"
            placeholder="Start: Haltestelle, Adresse, Ort"
            value={fromStop}
            location={location}
            locating={pending === "from" && !locationFailed}
            onSelect={(stop) => update({ ...query, from: stop })}
            onPickLocation={() => pickLocation("from")}
          />
          <ViaStopRows
            vias={viaRows}
            location={location}
            onChange={(rows) => {
              setEmptyVias(rows.filter((r) => r === null).length);
              update({ ...query, vias: rows.filter((r): r is ViaStop => r !== null) });
            }}
          />
          <div
            className={cn(viaRows.length > 0 ? "border-t" : "ml-8 border-t")}
            aria-hidden="true"
          />
          <StopPicker
            label="Nach"
            marker="end"
            placeholder="Ziel: Haltestelle, Adresse, Ort"
            value={toStop}
            location={location}
            locating={pending === "to" && !locationFailed}
            onSelect={(stop) => update({ ...query, to: stop })}
            onPickLocation={() => pickLocation("to")}
          />
          {/* gepunktete Verbindung zwischen Start- und Zielpunkt (ohne Zwischenhalte) */}
          {viaRows.length === 0 && (
            <span
              className="pointer-events-none absolute top-[1.6rem] left-[1.05rem] h-[1.15rem] border-l-2 border-dotted border-muted-foreground/60"
              aria-hidden="true"
            />
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Start und Ziel tauschen"
            title="Start und Ziel tauschen"
            className={cn(
              "absolute right-2 z-10 rounded-full bg-card text-muted-foreground",
              viaRows.length === 0 ? "top-1/2 -translate-y-1/2" : "-top-3",
            )}
            disabled={from === null && to === null}
            onClick={() => update(swapJourneyQuery({ ...query, from: fromStop, to: toStop }))}
          >
            <ArrowUpDown aria-hidden="true" />
          </Button>
        </div>

        <AddViaButton count={viaRows.length} onAdd={() => setEmptyVias((n) => n + 1)} />

        <div className="flex items-center gap-1.5">
          <JourneyTimeSheet
            time={query.time}
            arrive={query.arrive}
            now={now}
            onChange={(time, arrive) => update({ ...query, time, arrive })}
          />
          <JourneyOptionsSheet
            options={query.options}
            onChange={(next) => update({ ...query, options: next })}
          />
          {optionsSummary && (
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {optionsSummary}
            </p>
          )}
        </div>
      </div>

      {locationMessage && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {locationMessage} {locationFailed && locationStatus === "denied" && <LocationHelp />}
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

      {ready && legs.length > 0 && (
        <LegJourneys legs={legs} time={query.time} arrive={query.arrive} options={options} />
      )}

      {ready && legs.length === 0 && (
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
                  <JourneyList
                    journeys={data.journeys}
                    savedSignature={savedTrip?.signature ?? null}
                    onSave={(journey) => {
                      if (!fromStop || !toStop) return;
                      const signature = journeySignature(journey);
                      if (savedTrip?.signature !== signature) {
                        setSavedTrip({
                          from: fromStop,
                          to: toStop,
                          options,
                          signature,
                          journey,
                          savedAt: new Date().toISOString(),
                        });
                      }
                      void navigate("/fahrt");
                    }}
                  />
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
