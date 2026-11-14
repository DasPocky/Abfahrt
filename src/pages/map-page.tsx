// Karte mit Haltestellen (/abfahrt/karte). Lazy geladen, siehe src/pages/lazy-map-page.tsx.
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, LoaderCircle, LocateFixed, X } from "lucide-react";
import type { Stop } from "../../shared/api-types";
import { StopMap, type MapView } from "@/components/stop-map";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocation } from "@/hooks/use-location";
import { stopPath } from "@/lib/api";
import type { Position } from "@/lib/geo";
import { areaForBounds, fetchStopsInArea } from "@/lib/map-area";

/** Startpunkt ohne Standort: Düsseldorf Innenstadt (Heinrich-Heine-Allee) */
const DEFAULT_CENTER: Position = { lat: 51.2255, lon: 6.7775 };
const DEFAULT_ZOOM = 15;
/** Erst laden, wenn die Karte so lange stillsteht */
const MAP_DEBOUNCE_MS = 400;
/** Bereits geladene Haltestellen behalten (flüssiges Verschieben), aber nicht unbegrenzt */
const MAX_KEPT_STOPS = 2000;

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeDark(onChange: () => void) {
  const media = window.matchMedia?.(DARK_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia?.(DARK_QUERY).matches ?? false,
    () => false,
  );
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
  const [selected, setSelected] = useState<Stop | null>(null);
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
          selectedId={selected?.id ?? null}
          userPosition={location.position}
          dark={dark}
          onViewChange={setView}
          onSelect={setSelected}
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

        {selected && (
          <div
            role="group"
            aria-label={selected.name}
            className="absolute inset-x-2 bottom-7 flex items-center gap-2 rounded-xl border bg-background p-3 shadow-lg"
          >
            <p className="line-clamp-2 min-w-0 flex-1 leading-snug font-medium">{selected.name}</p>
            <Button asChild size="sm">
              <Link to={stopPath(selected.id)}>
                Abfahrten
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Schließen"
              onClick={() => setSelected(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}

        <p className="absolute right-0 bottom-0 rounded-tl-md bg-background/85 px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            OpenStreetMap-Mitwirkende
          </a>
          ,{" "}
          <a
            href="https://openfreemap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            OpenFreeMap
          </a>{" "}
          ·{" "}
          <a
            href="https://www.openmaptiles.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            OpenMapTiles
          </a>
        </p>
      </div>
    </section>
  );
}

export default MapPage;
