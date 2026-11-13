import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router";
import { ArrowLeft, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { DepartureList } from "@/components/departure-list";
import { SourceAttribution } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError, fetchDepartures } from "@/lib/api";
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
  const now = useNow(COUNTDOWN_TICK_MS);

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["departures", stopId],
    queryFn: ({ signal }) => fetchDepartures(stopId, signal),
    enabled: stopId !== "",
    refetchInterval: DEPARTURES_REFETCH_MS,
  });

  const title = data?.stop.name ?? stopNameFromState(location.state) ?? "Haltestelle";

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
          {data && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Stand{" "}
              <time dateTime={data.generatedAt}>
                {formatClockWithSeconds(new Date(data.generatedAt))}
              </time>
            </p>
          )}
        </div>
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
          {data && <DepartureList departures={data.departures} now={now} />}
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
