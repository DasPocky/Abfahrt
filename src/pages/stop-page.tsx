import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { ArrowLeft, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { DepartureList } from "@/components/departure-list";
import { FavoriteButton } from "@/components/favorite-button";
import { FilterBar } from "@/components/filter-bar";
import { SourceAttribution } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError, fetchDepartures } from "@/lib/api";
import {
  type DepartureFilter,
  describeFilter,
  filterDepartures,
  filterFromParams,
  filterToParams,
  isEmptyFilter,
} from "@/lib/filters";
import { formatClockWithSeconds } from "@/lib/time";

/** Abruf der Abfahrten */
export const DEPARTURES_REFETCH_MS = 30_000;
/** Aktualisierung nur der Countdown-Anzeige */
export const COUNTDOWN_TICK_MS = 15_000;

function stopNameFromState(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null) return undefined;
  const name = (state as { stopName?: unknown }).stopName;
  return typeof name === "string" ? name : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 404) {
    return "Diese Haltestelle wurde nicht gefunden.";
  }
  return "Abfahrten konnten nicht geladen werden.";
}

export function StopPage() {
  const { stopId = "" } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFromParams(searchParams);
  const setFilter = (next: DepartureFilter) =>
    setSearchParams(filterToParams(next), { replace: true });
  const liveNow = useNow(COUNTDOWN_TICK_MS);
  // Bei gewähltem Zeitpunkt zählt der Countdown ab diesem Zeitpunkt
  const now = filter.time ? new Date(filter.time) : liveNow;

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["departures", stopId, filter.time ?? "now"],
    queryFn: ({ signal }) => fetchDepartures(stopId, signal, filter.time),
    enabled: stopId !== "",
    refetchInterval: filter.time ? false : DEPARTURES_REFETCH_MS,
  });
  const visible = data ? filterDepartures(data.departures, filter) : [];

  const knownName = data?.stop.name ?? stopNameFromState(location.state);
  const title = knownName ?? "Haltestelle";

  return (
    <section aria-labelledby="stop-title" className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft aria-hidden="true" />
          Zurück zur Suche
        </Link>
      </Button>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 id="stop-title" className="text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {data?.stop.place && <p className="text-sm text-muted-foreground">{data.stop.place}</p>}
          {!isEmptyFilter(filter) && (
            <p className="text-sm font-medium">Ansicht: {describeFilter(filter)}</p>
          )}
          {data && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Stand{" "}
              <time dateTime={data.generatedAt}>
                {formatClockWithSeconds(new Date(data.generatedAt))}
              </time>
            </p>
          )}
        </div>
        {knownName && (
          <FavoriteButton
            stop={{ id: stopId, name: knownName, place: data?.stop.place }}
            filter={filter}
          />
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Aktualisieren"
        >
          <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden="true" />
        </Button>
      </div>

      {data && <FilterBar departures={data.departures} filter={filter} onChange={setFilter} />}

      <Card className="py-0">
        <CardContent className="px-4">
          {isPending && (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Abfahrten werden geladen …
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
          {data && data.departures.length > 0 && visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm">
              <p className="text-muted-foreground">Keine Abfahrten für diese Auswahl.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter({ ...filter, modes: [], lines: [], platforms: [] })}
              >
                Filter zurücksetzen
              </Button>
            </div>
          ) : (
            data && <DepartureList departures={visible} now={now} />
          )}
        </CardContent>
      </Card>

      {isError && data && (
        <p role="status" className="text-xs text-warning">
          Aktualisierung fehlgeschlagen, angezeigt wird der letzte Stand.
        </p>
      )}

      {data && <SourceAttribution source={data.source} />}
    </section>
  );
}
