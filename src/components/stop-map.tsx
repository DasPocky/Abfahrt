// MapLibre-Karte mit Haltestellen. Wird nur über die lazy geladene Kartenseite eingebunden,
// damit MapLibre (ca. 1 MB) nicht im Haupt-Bundle landet.
import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
// Eigene Datei statt Blob: Der Worker kommt von der eigenen Origin, das erlaubt `worker-src 'self'`.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Point } from "geojson";
import type { Stop } from "../../shared/api-types";
import type { Position } from "@/lib/geo";
import type { Bounds } from "@/lib/map-area";

setWorkerUrl(workerUrl);

/** Kartenstile von OpenFreeMap (OSM-Vektorkacheln, ohne Key), siehe docs/01-datenquellen.md */
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

const STOPS_LAYER = "abfahrt-stops";
/** Antippen trifft eine Haltestelle auch knapp daneben (Finger statt Mauszeiger) */
const TAP_TOLERANCE_PX = 12;

const COLORS = {
  light: { fill: "#ffffff", stroke: "#171717", text: "#171717", halo: "#ffffff", me: "#2563eb" },
  dark: { fill: "#262626", stroke: "#fafafa", text: "#fafafa", halo: "#0a0a0a", me: "#60a5fa" },
};

export interface MapView {
  bounds: Bounds;
  zoom: number;
}

interface StopMapProps {
  initialCenter: Position;
  initialZoom: number;
  /** Wechselt der Wert, fährt die Karte dorthin (z. B. Standort) */
  focus: Position | null;
  stops: readonly Stop[];
  selectedId: string | null;
  userPosition: Position | null;
  dark: boolean;
  onViewChange: (view: MapView) => void;
  onSelect: (stop: Stop | null) => void;
}

type Collection = FeatureCollection<Point>;

function stopsToGeoJson(stops: readonly Stop[], selectedId: string | null): Collection {
  return {
    type: "FeatureCollection",
    features: stops.flatMap((stop) =>
      stop.lat === undefined || stop.lon === undefined
        ? []
        : [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [stop.lon, stop.lat] },
              properties: { id: stop.id, name: stop.name, selected: stop.id === selectedId },
            },
          ],
    ),
  };
}

function positionToGeoJson(position: Position | null): Collection {
  return {
    type: "FeatureCollection",
    features: position
      ? [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [position.lon, position.lat] },
            properties: {},
          },
        ]
      : [],
  };
}

/** Eigene Quellen und Ebenen; nach jedem Stilwechsel (hell/dunkel) neu anlegen */
function addOwnLayers(map: MapLibreMap, dark: boolean, stops: Collection, me: Collection) {
  const c = dark ? COLORS.dark : COLORS.light;
  map.addSource("abfahrt-me", { type: "geojson", data: me });
  map.addSource("abfahrt-stops", { type: "geojson", data: stops });
  map.addLayer({
    id: "abfahrt-me",
    type: "circle",
    source: "abfahrt-me",
    paint: {
      "circle-radius": 7,
      "circle-color": c.me,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: STOPS_LAYER,
    type: "circle",
    source: "abfahrt-stops",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        ["case", ["get", "selected"], 7, 4.5],
        18,
        ["case", ["get", "selected"], 11, 8],
      ],
      "circle-color": ["case", ["get", "selected"], c.stroke, c.fill],
      "circle-stroke-color": ["case", ["get", "selected"], c.fill, c.stroke],
      "circle-stroke-width": ["case", ["get", "selected"], 3, 2],
    },
  });
  map.addLayer({
    id: "abfahrt-stop-labels",
    type: "symbol",
    source: "abfahrt-stops",
    minzoom: 16,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.9],
      "text-max-width": 9,
      "text-optional": true,
    },
    paint: { "text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 1.5 },
  });
}

function viewOf(map: MapLibreMap): MapView {
  const b = map.getBounds();
  return {
    bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
    zoom: map.getZoom(),
  };
}

export function StopMap({
  initialCenter,
  initialZoom,
  focus,
  stops,
  selectedId,
  userPosition,
  dark,
  onViewChange,
  onSelect,
}: StopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Aktuelle Werte für die MapLibre-Ereignisse, ohne die Karte neu anzulegen
  const latest = useRef({ stops, selectedId, userPosition, dark, onViewChange, onSelect });
  latest.current = { stops, selectedId, userPosition, dark, onViewChange, onSelect };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const map = new MapLibreMap({
      container,
      style: latest.current.dark ? MAP_STYLES.dark : MAP_STYLES.light,
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      maxZoom: 19,
      // Quellhinweis zeigt die Kartenseite selbst (deutsch, immer sichtbar)
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("style.load", () => {
      const { stops: s, selectedId: sel, userPosition: me, dark: d } = latest.current;
      addOwnLayers(map, d, stopsToGeoJson(s, sel), positionToGeoJson(me));
    });
    map.on("load", () => latest.current.onViewChange(viewOf(map)));
    map.on("moveend", () => latest.current.onViewChange(viewOf(map)));
    map.on("click", (event) => {
      const { x, y } = event.point;
      const hits: MapGeoJSONFeature[] = map.getLayer(STOPS_LAYER)
        ? map.queryRenderedFeatures(
            [
              [x - TAP_TOLERANCE_PX, y - TAP_TOLERANCE_PX],
              [x + TAP_TOLERANCE_PX, y + TAP_TOLERANCE_PX],
            ],
            { layers: [STOPS_LAYER] },
          )
        : [];
      const id = hits[0]?.properties.id as unknown;
      const stop = latest.current.stops.find((s) => s.id === id) ?? null;
      latest.current.onSelect(stop);
    });
    map.on("mousemove", STOPS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", STOPS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Die Karte wird einmal angelegt, spätere Änderungen laufen über die Effekte unten
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource<GeoJSONSource>("abfahrt-stops");
    void source?.setData(stopsToGeoJson(stops, selectedId));
  }, [stops, selectedId]);

  useEffect(() => {
    void mapRef.current
      ?.getSource<GeoJSONSource>("abfahrt-me")
      ?.setData(positionToGeoJson(userPosition));
  }, [userPosition]);

  useEffect(() => {
    if (focus) mapRef.current?.easeTo({ center: [focus.lon, focus.lat], duration: 600 });
  }, [focus]);

  const styleRef = useRef(dark);
  useEffect(() => {
    if (styleRef.current === dark) return;
    styleRef.current = dark;
    mapRef.current?.setStyle(dark ? MAP_STYLES.dark : MAP_STYLES.light, { diff: false });
  }, [dark]);

  return (
    <div
      ref={containerRef}
      className="size-full"
      role="region"
      aria-label="Karte mit Haltestellen"
    />
  );
}
