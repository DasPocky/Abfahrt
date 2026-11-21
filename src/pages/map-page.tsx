// Karte mit Haltestellen (/karte). Lazy geladen, siehe src/pages/lazy-map-page.tsx.
import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, LoaderCircle, LocateFixed, TramFront, X } from "lucide-react";
import type { Stop } from "../../shared/api-types";
import { LineBadge } from "@/components/line-badge";
import { MapAttribution } from "@/components/map-attribution";
import { StopMap, type MapSelection, type MapView } from "@/components/stop-map";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import { usePrefersDark } from "@/hooks/use-prefers-dark";
import { stopPath, tripPath } from "@/lib/api";
import type { Position } from "@/lib/geo";
import {
  areaForBounds,
  fetchStopsInArea,
  mergeStop,
  platformDeparturesPath,
  platformSummary,
  selectionKey,
  tilesForBounds,
} from "@/lib/map-area";
import { fetchVehicles, vehiclePositions, type VehiclePosition } from "@/lib/vehicles";
import { usePageTitle } from "@/hooks/use-page-title";

/** Startpunkt ohne Standort: Düsseldorf Innenstadt (Heinrich-Heine-Allee) */
const DEFAULT_CENTER: Position = { lat: 51.2255, lon: 6.7775 };
const DEFAULT_ZOOM = 15;
/** Erst laden, wenn die Karte so lange stillsteht */
const MAP_DEBOUNCE_MS = 400;
/** Kacheln mit Haltestellen gelten so lange als frisch (Browser-Cache des Workers: 1 Tag) */
const TILE_FRESH_MS = 24 * 60 * 60_000;
/** Bereits geladene Haltestellen behalten (flüssiges Verschieben), aber nicht unbegrenzt */
const MAX_KEPT_STOPS = 2000;

/** Live-Fahrzeuge an/aus, je Gerät gemerkt (#92) */
const LIVE_KEY = "abfahrt:map-live";
/** Neue Abschnitte je Minute; dazwischen rechnet die App die Positionen jede Sekunde */
const VEHICLES_REFRESH_MS = 60_000;

function readLive(): boolean {
  try {
    return localStorage.getItem(LIVE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeLive(on: boolean) {
  try {
    localStorage.setItem(LIVE_KEY, on ? "on" : "off");
  } catch {
    // ohne Speicher gilt die Wahl nur für diesen Besuch
  }
}

/** „nächster Halt X“ bzw. „hält an X“ */
function vehicleWhere(v: VehiclePosition): string | null {
  return v.nextStop ? `${v.atStop ? "Hält an" : "Nächster Halt"} ${v.nextStop}` : null;
}

/** „Echtzeit · +2 Min“ bzw. „nach Fahrplan“ */
function vehicleTime(v: VehiclePosition): string {
  if (!v.realtime) return "nach Fahrplan";
  const delay = v.delayMinutes ?? 0;
  return delay > 0 ? `Echtzeit · +${delay} Min` : "Echtzeit · pünktlich";
}

function mergeStops(known: Map<string, Stop>, incoming: readonly Stop[]): Map<string, Stop> {
  const next = new Map(known);
  for (const stop of incoming) {
    const before = next.get(stop.id);
    next.delete(stop.id);
    // Haltestelle auf einer Kachelgrenze: Steige beider Kacheln zusammenführen (#98)
    next.set(stop.id, before ? mergeStop(before, stop) : stop);
  }
  // Älteste Einträge zuerst verwerfen
  for (const id of next.keys()) {
    if (next.size <= MAX_KEPT_STOPS) break;
    next.delete(id);
  }
  return next;
}

export function MapPage() {
  usePageTitle("Karte");
  const location = useLocation();
  const dark = usePrefersDark();
  const [view, setView] = useState<MapView | null>(null);
  const debouncedView = useDebouncedValue(view, MAP_DEBOUNCE_MS);
  const area = debouncedView ? areaForBounds(debouncedView.bounds, debouncedView.zoom) : null;
  // Haltestellen in festen Kacheln (#98), Fahrzeuge weiter für den Ausschnitt
  const tiles = debouncedView ? tilesForBounds(debouncedView.bounds, debouncedView.zoom) : null;
  const tooFar = view !== null && areaForBounds(view.bounds, view.zoom) === null;
  const [known, setKnown] = useState<Map<string, Stop>>(() => new Map());
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [live, setLive] = useState(readLive);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const now = useNow(live ? 1000 : 60_000);
  const selected = selection?.stop ?? null;
  // Antippen von „Mein Standort“; sonst fährt die Karte einmal zum Standort, sobald er da ist
  // (nur wenn in der App schon erlaubt, siehe useLocation)
  const [manualFocus, setManualFocus] = useState<Position | null>(null);
  const focus = manualFocus ?? location.position;

  const tileQueries = useQueries({
    queries: (tiles ?? []).map((tile) => ({
      queryKey: ["stops", "tile", tile.min, tile.max],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const result = await fetchStopsInArea(tile, signal);
        // Geladene Haltestellen bleiben beim Verschieben sichtbar
        setKnown((prev) => mergeStops(prev, result.stops));
        return result;
      },
      // Haltestellen ändern sich selten: einen Tag frisch, so lange auch im Speicher
      staleTime: TILE_FRESH_MS,
      gcTime: TILE_FRESH_MS,
    })),
  });
  const isFetching = tileQueries.some((q) => q.isFetching);
  const isError = tileQueries.some((q) => q.isError);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", area?.min, area?.max],
    queryFn: ({ signal }) => fetchVehicles(area!, signal),
    enabled: live && area !== null,
    refetchInterval: VEHICLES_REFRESH_MS,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const segments = live && !tooFar ? vehiclesQuery.data?.segments : undefined;
  const nowMs = now.getTime();
  const vehicles = useMemo(
    () => (segments ? vehiclePositions(segments, nowMs) : []),
    [segments, nowMs],
  );
  const selectedVehicle = vehicles.find((v) => v.trip === selectedTrip) ?? null;
  // Für die flüssige Fahrt auf der Karte: Positionen zu jedem Zeitpunkt
  const vehiclesAt = useCallback(
    (ms: number) => (segments ? vehiclePositions(segments, ms) : []),
    [segments],
  );

  function toggleLive() {
    setLive((on) => {
      writeLive(!on);
      return !on;
    });
    setSelectedTrip(null);
  }

  function onSelectStop(next: MapSelection | null) {
    setSelection(next);
    setSelectedTrip(null);
  }

  function onSelectVehicle(vehicle: VehiclePosition) {
    setSelectedTrip(vehicle.trip);
    setSelection(null);
  }

  function onLocate() {
    if (location.position) setManualFocus({ ...location.position });
    else if (location.status !== "locating") location.toggle();
  }

  const stops = useMemo(() => [...known.values()], [known]);
  let hint: string | null = null;
  if (tooFar) hint = "Zum Anzeigen der Haltestellen näher heranzoomen";
  else if (isError) hint = "Haltestellen konnten nicht geladen werden";
  else if (live && vehiclesQuery.isError) hint = "Fahrzeuge konnten nicht geladen werden";

  return (
    <section aria-labelledby="map-title" className="space-y-2">
      {/* nicht nur „Karte“: so heißt schon die Kartenfläche von MapLibre (eindeutige Bereiche, #128) */}
      <h1 id="map-title" className="sr-only">
        Karte mit Haltestellen und Fahrzeugen
      </h1>
      <div className="relative h-[calc(100dvh-6.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-96 overflow-hidden rounded-xl border bg-muted">
        <StopMap
          initialCenter={DEFAULT_CENTER}
          initialZoom={DEFAULT_ZOOM}
          focus={focus}
          stops={stops}
          selectedKey={
            selection ? selectionKey(selection.stop.id, selection.platform?.track ?? null) : null
          }
          userPosition={location.position}
          dark={dark}
          onViewChange={setView}
          onSelect={onSelectStop}
          vehicles={vehicles}
          vehiclesAt={vehiclesAt}
          selectedTrip={selectedVehicle?.trip ?? null}
          onSelectVehicle={onSelectVehicle}
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-14">
          {(hint || isFetching) && (
            <p
              role="status"
              className="flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1 text-xs shadow-sm"
            >
              {isFetching && !hint && (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              )}
              {hint ?? "Haltestellen werden geladen …"}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 left-2 bg-background shadow-sm"
          aria-label="Mein Standort"
          onClick={onLocate}
        >
          {location.status === "locating" ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed aria-hidden="true" />
          )}
        </Button>

        <Button
          variant={live ? "default" : "outline"}
          size="icon"
          className={
            live
              ? "absolute top-13 left-2 shadow-sm"
              : "absolute top-13 left-2 bg-background shadow-sm"
          }
          aria-label="Live-Fahrzeuge"
          aria-pressed={live}
          title={live ? "Live-Fahrzeuge ausblenden" : "Live-Fahrzeuge zeigen"}
          onClick={toggleLive}
        >
          <TramFront aria-hidden="true" />
        </Button>

        {selectedVehicle && (
          <div
            role="group"
            aria-label={`Linie ${selectedVehicle.line}`}
            className="absolute inset-x-2 bottom-7 flex items-center gap-2 rounded-xl border bg-background p-3 shadow-lg"
          >
            <LineBadge
              departure={{
                line: selectedVehicle.line,
                mode: selectedVehicle.mode,
                lineColor: selectedVehicle.color,
                lineTextColor: null,
              }}
            />
            <p className="min-w-0 flex-1 leading-snug">
              {vehicleWhere(selectedVehicle) && (
                <span className="line-clamp-2 text-sm font-medium">
                  {vehicleWhere(selectedVehicle)}
                </span>
              )}
              <span className="block text-xs text-muted-foreground">
                {vehicleTime(selectedVehicle)} · Position geschätzt
              </span>
            </p>
            {/* Fahrtverlauf (#120); die Fahrzeuge kommen von Transitous */}
            <Button asChild size="sm" variant="outline">
              <Link to={tripPath(`transitous|${selectedVehicle.trip}`)}>
                Verlauf
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Schließen"
              onClick={() => setSelectedTrip(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}

        {selected && (
          <div
            role="group"
            aria-label={selected.name}
            className="absolute inset-x-2 bottom-7 flex items-center gap-2 rounded-xl border bg-background p-3 shadow-lg"
          >
            <p className="min-w-0 flex-1 leading-snug">
              <span className="line-clamp-2 font-medium">{selected.name}</span>
              {selection?.platform && (
                <span className="block text-xs text-muted-foreground">
                  {platformSummary(selection.platform)}
                </span>
              )}
            </p>
            <Button asChild size="sm">
              <Link to={platformDeparturesPath(stopPath(selected.id), selection?.platform ?? null)}>
                Abfahrten
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Schließen"
              onClick={() => setSelection(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}

        <MapAttribution />
      </div>
    </section>
  );
}

export default MapPage;

// Die Routenkarte (Verbindungsdetails) kommt aus demselben lazy Chunk „map-page-*“: MapLibre liegt
// so nur einmal vor, und der Service Worker lässt den Chunk aus der Offline-Hülle (precache.ts)
export { RouteMapPanel } from "@/components/route-map-panel";
