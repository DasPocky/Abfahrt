// MapLibre-Karte mit Haltestellen. Wird nur über die lazy geladene Kartenseite eingebunden,
// damit MapLibre (ca. 1 MB) nicht im Haupt-Bundle landet.
import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { Stop, StopPlatform, TransportMode } from "../../shared/api-types";
import { MAP_LOCALE, mapStyle } from "@/components/map-base";
import type { Position } from "@/lib/geo";
import { selectionKey, type Bounds } from "@/lib/map-area";

const STOPS_LAYER = "abfahrt-stops";

/** Farbe eines Steigs nach dem wichtigsten Verkehrsmittel (wie die Fallback-Farben der Linien) */
const MODE_HEX: Record<TransportMode, string> = {
  longdistance: "#404040",
  regional: "#525252",
  suburban: "#15803d",
  subway: "#2563eb",
  tram: "#dc2626",
  bus: "#ca8a04",
  ferry: "#0891b2",
  other: "#737373",
};

/** Ausgewählt: Haltestelle und ggf. ein Steig */
export interface MapSelection {
  stop: Stop;
  platform: StopPlatform | null;
}

/** Steige einer Haltestelle; ohne Angaben die Haltestelle selbst als einziger Punkt */
function platformsOf(stop: Stop): StopPlatform[] {
  if (stop.platforms && stop.platforms.length > 0) return stop.platforms;
  if (stop.lat === undefined || stop.lon === undefined) return [];
  return [{ track: null, lat: stop.lat, lon: stop.lon, modes: [] }];
}
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
  /** Ausgewählter Steig als „<Haltestellen-ID>|<Steig>“ bzw. nur die ID */
  selectedKey: string | null;
  userPosition: Position | null;
  dark: boolean;
  onViewChange: (view: MapView) => void;
  onSelect: (selection: MapSelection | null) => void;
}

type Collection = FeatureCollection<Point>;

/** Jeder Steig ein Punkt an seiner echten Position (#84), dazu der Name einmal je Haltestelle */
function stopsToGeoJson(stops: readonly Stop[], selectedKey: string | null): Collection {
  return {
    type: "FeatureCollection",
    features: stops.flatMap((stop) =>
      platformsOf(stop).map((platform) => {
        const key = selectionKey(stop.id, platform.track);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [platform.lon, platform.lat] },
          properties: {
            key,
            id: stop.id,
            track: platform.track ?? "",
            color: MODE_HEX[platform.modes[0] ?? "other"],
            // Zweites Verkehrsmittel als Ring (z. B. U-Bahn + Straßenbahn: blau mit rotem Ring)
            ring: platform.modes[1] ? MODE_HEX[platform.modes[1]] : "",
            selected: key === selectedKey || stop.id === selectedKey,
          },
        };
      }),
    ),
  };
}

/** Name je Haltestelle am ersten Steig (kein gemittelter Punkt) */
function namesToGeoJson(stops: readonly Stop[]): Collection {
  return {
    type: "FeatureCollection",
    features: stops.flatMap((stop) => {
      const first = platformsOf(stop)[0];
      return first
        ? [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [first.lon, first.lat] },
              properties: { name: stop.name },
            },
          ]
        : [];
    }),
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
function addOwnLayers(
  map: MapLibreMap,
  dark: boolean,
  stops: Collection,
  names: Collection,
  me: Collection,
) {
  const c = dark ? COLORS.dark : COLORS.light;
  map.addSource("abfahrt-me", { type: "geojson", data: me });
  map.addSource("abfahrt-stops", { type: "geojson", data: stops });
  map.addSource("abfahrt-stop-names", { type: "geojson", data: names });
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
        ["case", ["get", "selected"], 6, 3.5],
        18,
        ["case", ["get", "selected"], 12, 9],
      ],
      "circle-color": ["get", "color"],
      "circle-stroke-color": [
        "case",
        ["get", "selected"],
        c.stroke,
        ["!=", ["get", "ring"], ""],
        ["get", "ring"],
        c.fill,
      ],
      "circle-stroke-width": [
        "case",
        ["get", "selected"],
        3,
        ["!=", ["get", "ring"], ""],
        ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 3.5],
        1.5,
      ],
    },
  });
  // Steig-Nummer im Punkt (herangezoomt)
  map.addLayer({
    id: "abfahrt-stop-tracks",
    type: "symbol",
    source: "abfahrt-stops",
    minzoom: 16.5,
    layout: {
      "text-field": ["get", "track"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "abfahrt-stop-labels",
    type: "symbol",
    source: "abfahrt-stop-names",
    minzoom: 16,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 1.1],
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
  selectedKey,
  userPosition,
  dark,
  onViewChange,
  onSelect,
}: StopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Aktuelle Werte für die MapLibre-Ereignisse, ohne die Karte neu anzulegen
  const latest = useRef({ stops, selectedKey, userPosition, dark, onViewChange, onSelect });
  latest.current = { stops, selectedKey, userPosition, dark, onViewChange, onSelect };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const map = new MapLibreMap({
      container,
      style: mapStyle(latest.current.dark),
      locale: MAP_LOCALE,
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
      const { stops: s, selectedKey: sel, userPosition: me, dark: d } = latest.current;
      addOwnLayers(map, d, stopsToGeoJson(s, sel), namesToGeoJson(s), positionToGeoJson(me));
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
      const props: unknown = hits[0]?.properties;
      const id = typeof props === "object" && props !== null && "id" in props ? props.id : null;
      const track =
        typeof props === "object" &&
        props !== null &&
        "track" in props &&
        typeof props.track === "string"
          ? props.track
          : "";
      const stop = latest.current.stops.find((s) => s.id === id) ?? null;
      const platform = stop
        ? (platformsOf(stop).find((p) => (p.track ?? "") === track) ?? null)
        : null;
      latest.current.onSelect(stop ? { stop, platform } : null);
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
    void source?.setData(stopsToGeoJson(stops, selectedKey));
    const names = mapRef.current?.getSource<GeoJSONSource>("abfahrt-stop-names");
    void names?.setData(namesToGeoJson(stops));
  }, [stops, selectedKey]);

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
    mapRef.current?.setStyle(mapStyle(dark), { diff: false });
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
