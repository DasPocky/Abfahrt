// Fahrtverlauf einer Abfahrt (#120): alle Halte mit Echtzeit, wo die Fahrt gerade ist, Strecke
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronDown,
  LoaderCircle,
  Map as MapIcon,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { cn } from "cn";
import { BottomSheet } from "@/components/bottom-sheet";
import { NOTICE_CLASS, NoticeList } from "@/components/departure-list";
import { Clock } from "@/components/journey-details";
import { LazyRouteMap } from "@/components/lazy-route-map";
import { LineBadge } from "@/components/line-badge";
import { ModeIcon } from "@/components/mode-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError, fetchTrip, stopPath } from "@/lib/api";
import { legBadge } from "@/lib/connections";
import { lineBadgeColors } from "@/lib/line-colors";
import { platformLabel } from "@/lib/modes";
import { stopIndex, tripProgress, tripStops } from "@/lib/trip";
import { formatClockWithSeconds } from "@/lib/time";
import type { JourneyLeg, JourneyStop } from "../../shared/api-types";

const REFRESH_MS = 30_000;
const TICK_MS = 15_000;

function StopTime({ stop, last }: { stop: JourneyStop; last: boolean }) {
  // Abfahrt; am Ziel (und wo es keine gibt) die Ankunft
  const useArrival = last || stop.plannedDeparture === null;
  return (
    <Clock
      planned={useArrival ? stop.plannedArrival : stop.plannedDeparture}
      realtime={useArrival ? stop.realtimeArrival : stop.realtimeDeparture}
      cancelled={stop.cancelled}
    />
  );
}

function TripStopList({ leg, fromIndex, now }: { leg: JourneyLeg; fromIndex: number; now: Date }) {
  const stops = tripStops(leg);
  const progress = tripProgress(stops, now);
  const colors = lineBadgeColors(legBadge(leg));
  const lineStyle = colors.style ? { backgroundColor: colors.style.backgroundColor } : undefined;
  const fromRef = useRef<HTMLLIElement>(null);
  const scrolled = useRef(false);

  // Einmal zur eigenen Haltestelle scrollen
  useEffect(() => {
    if (scrolled.current || !fromRef.current) return;
    scrolled.current = true;
    fromRef.current.scrollIntoView?.({ block: "center" });
  }, []);

  const passed = (index: number) =>
    progress.state === "after" || (progress.state === "between" && index <= progress.index);

  return (
    <ol aria-label="Halte" className="py-1">
      {stops.map((stop, index) => {
        const first = index === 0;
        const last = index === stops.length - 1;
        const isFrom = index === fromIndex;
        const vehicleHere = progress.state === "between" && progress.index === index;
        return (
          <li key={`${index}-${stop.id ?? stop.name}`} ref={isFrom ? fromRef : undefined}>
            <div
              className={cn(
                "grid grid-cols-[3.25rem_1rem_minmax(0,1fr)] gap-x-2 rounded-md px-1 text-sm",
                passed(index) && !isFrom && "opacity-55",
                isFrom && "bg-muted",
              )}
              aria-current={isFrom ? "location" : undefined}
            >
              <span className="py-1.5 text-right font-medium tabular-nums">
                <StopTime stop={stop} last={last} />
              </span>
              {/* Linie mit Punkt je Halt */}
              <span className="relative flex justify-center" aria-hidden="true">
                <span
                  className={cn(
                    "absolute w-1",
                    first ? "top-3" : "top-0",
                    last ? "h-3" : "bottom-0",
                    colors.className,
                  )}
                  style={lineStyle}
                />
                <span
                  className={cn(
                    "relative z-10 mt-[0.45rem] block rounded-full border-[3px] bg-background",
                    first || last || isFrom ? "size-3.5" : "size-2.5 border-2",
                  )}
                  style={{ borderColor: colors.style?.backgroundColor }}
                />
              </span>
              <span className="min-w-0 py-1.5">
                {stop.id ? (
                  <Link
                    to={stopPath(stop.id)}
                    state={{ stopName: stop.name }}
                    className={cn(
                      "underline-offset-2 hover:underline",
                      (first || last || isFrom) && "font-semibold",
                      stop.cancelled && "line-through",
                    )}
                  >
                    {stop.name}
                  </Link>
                ) : (
                  <span className={cn(stop.cancelled && "line-through")}>{stop.name}</span>
                )}
                {stop.platform !== null && !stop.cancelled && (
                  <span
                    className={cn(
                      "text-muted-foreground",
                      stop.plannedPlatform !== null && "font-semibold text-warning",
                    )}
                  >
                    {" · "}
                    {platformLabel(leg.mode ?? "other")} {stop.platform}
                  </span>
                )}
                {stop.cancelled && <span className="text-destructive"> · entfällt</span>}
                {isFrom && <span className="sr-only"> (deine Haltestelle)</span>}
              </span>
            </div>
            {vehicleHere && (
              <div
                className="grid grid-cols-[3.25rem_1rem_minmax(0,1fr)] gap-x-2 px-1 text-xs"
                data-vehicle
              >
                <span />
                <span className="relative flex justify-center" aria-hidden="true">
                  <span
                    className={cn("absolute inset-y-0 w-1", colors.className)}
                    style={lineStyle}
                  />
                  <span
                    className={cn(
                      "relative z-10 my-0.5 flex size-5 items-center justify-center rounded-full ring-2 ring-background",
                      colors.className,
                    )}
                    style={colors.style}
                  >
                    <ModeIcon mode={leg.mode ?? "other"} className="size-3" />
                  </span>
                </span>
                <span className="self-center font-medium">
                  {leg.line} ist gerade zwischen {stop.name} und {stops[index + 1]?.name}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function TripRoutePage() {
  const [params] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const from = params.get("von");
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow(TICK_MS);
  const [showMap, setShowMap] = useState(false);

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["trip", ref],
    queryFn: ({ signal }) => fetchTrip(ref, signal),
    enabled: ref !== "",
    refetchInterval: REFRESH_MS,
  });

  const leg = data?.leg;
  const stops = leg ? tripStops(leg) : [];
  const fromIndex = stopIndex(stops, from);
  const progress = tripProgress(stops, now);
  // Innerhalb der App zurück, beim direkten Aufruf zur Haltestelle bzw. Startseite
  const canGoBack = location.key !== "default";

  return (
    <section aria-labelledby="trip-route-title" className="space-y-4">
      {canGoBack ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 text-muted-foreground"
          onClick={() => void navigate(-1)}
        >
          <ArrowLeft aria-hidden="true" />
          Zurück
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
          <Link to={from ? stopPath(from) : "/"}>
            <ArrowLeft aria-hidden="true" />
            {from ? "Abfahrten" : "Startseite"}
          </Link>
        </Button>
      )}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1
            id="trip-route-title"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            {leg ? (
              <>
                <LineBadge departure={legBadge(leg)} />
                <span className="min-w-0 break-words">nach {leg.destination.name}</span>
              </>
            ) : (
              "Fahrtverlauf"
            )}
          </h1>
          {leg && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {progress.state === "before" && `Fährt ab ${leg.origin.name}`}
              {progress.state === "after" && "Fahrt beendet"}
              {progress.state === "between" && "Unterwegs"}
              {" · "}Stand{" "}
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
          disabled={isFetching || ref === ""}
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden="true" />
        </Button>
      </div>

      {leg && leg.notices.length > 0 && (
        <BottomSheet
          title={`Hinweise zu ${leg.line ?? "dieser Fahrt"}`}
          triggerClassName={NOTICE_CLASS}
          trigger={
            <>
              <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{leg.notices[0]}</span>
              {leg.notices.length > 1 && (
                <span className="shrink-0 text-muted-foreground">+{leg.notices.length - 1}</span>
              )}
            </>
          }
        >
          <NoticeList notices={leg.notices} />
        </BottomSheet>
      )}

      {leg?.path && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showMap}
            onClick={() => setShowMap((v) => !v)}
          >
            <MapIcon aria-hidden="true" />
            Karte
            <ChevronDown
              className={cn("transition-transform", showMap && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
          {showMap && (
            <LazyRouteMap
              journey={{
                id: "trip",
                legs: [leg],
                transfers: 0,
                durationMinutes: leg.durationMinutes,
              }}
            />
          )}
        </div>
      )}

      <Card className="py-2">
        <CardContent className="px-2">
          {ref === "" && (
            <p className="py-6 text-center text-sm text-muted-foreground">Keine Fahrt angegeben.</p>
          )}
          {ref !== "" && isPending && (
            <p
              role="status"
              className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Fahrtverlauf wird geladen …
            </p>
          )}
          {isError && !data && (
            <p role="alert" className="px-2 py-3 text-sm text-destructive">
              {error instanceof ApiRequestError && error.status === 404
                ? "Diese Fahrt ist nicht mehr im Fahrplan."
                : "Fahrtverlauf konnte nicht geladen werden."}
            </p>
          )}
          {leg && <TripStopList leg={leg} fromIndex={fromIndex} now={now} />}
        </CardContent>
      </Card>
    </section>
  );
}
