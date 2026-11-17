// Karte mit Haltestellen (/abfahrt/karte). Lazy geladen, siehe src/pages/lazy-map-page.tsx.
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { stopPath } from "@/lib/api";
import type { Position } from "@/lib/geo";
import {
  areaForBounds,
  fetchStopsInArea,
  platformDeparturesPath,
  platformSummary,
  selectionKey,
} from "@/lib/map-area";
import { fetchVehicles, vehiclePositions, type VehiclePosition } from "@/lib/vehicles";

/** Startpunkt ohne Standort: Düsseldorf Innenstadt (Heinrich-Heine-Allee) */
const DEFAULT_CENTER: Position = { lat: 51.2255, lon: 6.7775 };
const DEFAULT_ZOOM = 15;
/** Erst laden, wenn die Karte so lange stillsteht */
const MAP_DEBOUNCE_MS = 400;
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

/** „nächster Halt X · Echtzeit +2“ bzw. „hält an X · nach Fahrplan“ */
function vehicleSummary(v: VehiclePosition): string {
  const where = v.nextStop ? `${v.atStop ? "hält an" : "nächster Halt"} ${v.nextStop}` : null;
  let time = "nach Fahrplan";
  if (v.realtime) {
    const delay = v.delayMinutes ?? 0;
    time = delay > 0 ? `Echtzeit · +${delay} Min` : "Echtzeit · pünktlich";
  }
  return [where, time].filter(Boolean).join(" · ");
}

function mergeStops(known: Map<string, Stop>, incoming: readonly Stop[]): Map<string, Stop> {
  const next = new Map(known);
  for (const stop of incoming) {
    next.delete(stop.id);
    next.set(stop.id, stop);
  }
  // Älteste Einträge zuerst verwerfen
  for (const id of next.keys()) {
    if (next.size <= MAX_KEPT_STOPS) break;
    next.delete(id);
  }
  return next;
}

export function MapPage() {
  const location = useLocation();
  const dark = usePrefersDark();
  const [view, setView] = useState<MapView | null>(null);
  const debouncedView = useDebouncedValue(view, MAP_DEBOUNCE_MS);
  const area = debouncedView ? areaForBounds(debouncedView.bounds, debouncedView.zoom) : null;
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

  const { data, isFetching, isError } = useQuery({
    queryKey: ["stops", "area", area?.min, area?.max],
    queryFn: async ({ signal }) => {
      const result = await fetchStopsInArea(area!, signal);
      // Geladene Haltestellen bleiben beim Verschieben sichtbar
      setKnown((prev) => mergeStops(prev, result.stops));
      return result;
    },
    enabled: area !== null,
    staleTime: 60 * 60_000,
  });

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

  const stops = useMemo(
    () => [...(data ? mergeStops(known, data.stops) : known).values()],
    [known, data],
  );
  let hint: string | null = null;
  if (tooFar) hint = "Zum Anzeigen der Haltestellen näher heranzoomen";
  else if (isError) hint = "Haltestellen konnten nicht geladen werden";
  else if (live && vehiclesQuery.isError) hint = "Fahrzeuge konnten nicht geladen werden";

  return (
    <section aria-labelledby="map-title" className="space-y-2">
      <h1 id="map-title" className="sr-only">
        Karte
      </h1>
      <div className="relative h-[calc(100dvh-7.5rem)] min-h-96 overflow-hidden rounded-xl border bg-muted">
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
              <span className="line-clamp-2 text-sm">{vehicleSummary(selectedVehicle)}</span>
              <span className="block text-xs text-muted-foreground">
                Position geschätzt aus Fahrplan und Echtzeit
              </span>
            </p>
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
