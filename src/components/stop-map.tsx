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
import type { VehiclePosition } from "@/lib/vehicles";
import { mergeRadiusMeters, platformGroups, selectionKey, type Bounds } from "@/lib/map-area";

const STOPS_LAYER = "abfahrt-stops";
const VEHICLES_LAYER = "abfahrt-vehicles";
/** Ab hier stehen Steig-Nummern im Punkt und Haltestellennamen daneben */
const DETAIL_MIN_ZOOM = 16;

/** Farben der Verkehrsmittel (wie die Fallback-Farben der Linien) */
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

const COLORS = {
  light: { fill: "#ffffff", stroke: "#171717", text: "#171717", halo: "#ffffff", me: "#2563eb" },
  dark: { fill: "#262626", stroke: "#fafafa", text: "#fafafa", halo: "#0a0a0a", me: "#60a5fa" },
};

/** Marker: Durchmesser in CSS-Pixeln bei icon-size 1, gezeichnet in doppelter Auflösung */
const MARKER_PX = 22;
const MARKER_RATIO = 2;
/** Höchstens so viele Verkehrsmittel als Segmente, der Rest fällt weg */
const MARKER_MAX_MODES = 4;

/**
 * Bild-ID eines Markers: Theme, Auswahl und Verkehrsmittel. Die Bilder entstehen erst beim
 * ersten Gebrauch (`styleimagemissing`), so gibt es nur die tatsächlich nötigen Kombinationen.
 */
function markerId(modes: readonly TransportMode[], selected: boolean, dark: boolean): string {
  const list = modes.length > 0 ? modes.slice(0, MARKER_MAX_MODES) : ["other"];
  return `abfahrt-pie:${dark ? "d" : "l"}:${selected ? 1 : 0}:${list.join(",")}`;
}

function isMode(value: string): value is TransportMode {
  return value in MODE_HEX;
}

/** Kreis mit einem Tortenstück je Verkehrsmittel (z. B. U-Bahn + Straßenbahn halb blau, halb rot) */
function drawMarker(id: string): ImageData | null {
  const [prefix, theme, sel, list] = id.split(":");
  if (prefix !== "abfahrt-pie" || !list) return null;
  const modes = list.split(",").filter(isMode);
  const c = theme === "d" ? COLORS.dark : COLORS.light;
  const size = MARKER_PX * MARKER_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx || modes.length === 0) return null;
  const mid = size / 2;
  const border = (sel === "1" ? 3.5 : 2) * MARKER_RATIO;
  const radius = mid - border / 2 - MARKER_RATIO / 2;
  const step = (Math.PI * 2) / modes.length;
  modes.forEach((mode, i) => {
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.arc(mid, mid, radius, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step);
    ctx.closePath();
    ctx.fillStyle = MODE_HEX[mode];
    ctx.fill();
  });
  // Feine Trennlinien zwischen den Segmenten
  if (modes.length > 1) {
    ctx.strokeStyle = c.fill;
    ctx.lineWidth = MARKER_RATIO;
    for (let i = 0; i < modes.length; i++) {
      const angle = -Math.PI / 2 + i * step;
      ctx.beginPath();
      ctx.moveTo(mid, mid);
      ctx.lineTo(mid + Math.cos(angle) * radius, mid + Math.sin(angle) * radius);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(mid, mid, radius, 0, Math.PI * 2);
  ctx.strokeStyle = sel === "1" ? c.stroke : c.fill;
  ctx.lineWidth = border;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

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
  /** Live-Fahrzeuge (#92), leer wenn ausgeschaltet */
  vehicles: readonly VehiclePosition[];
  /** Fahrt-ID des ausgewählten Fahrzeugs */
  selectedTrip: string | null;
  onSelectVehicle: (vehicle: VehiclePosition) => void;
}

type Collection = FeatureCollection<Point>;

/** Gruppierung nur in halben Zoomstufen neu berechnen, nicht bei jedem Bild */
function zoomBucket(zoom: number): number {
  return Math.floor(zoom * 2) / 2;
}

/**
 * Punkte der Haltestellen (#84, #86): jeder Steig an seiner echten Position. Nur Steige, die bei
 * dieser Zoomstufe auf dem Bildschirm zusammenfallen würden, werden ein gemeinsamer Punkt;
 * antippen öffnet dann die ganze Haltestelle.
 */
function stopsToGeoJson(
  stops: readonly Stop[],
  selectedKey: string | null,
  zoom: number,
  dark: boolean,
): Collection {
  const selectedStop = selectedKey?.split("|")[0] ?? null;
  return {
    type: "FeatureCollection",
    features: stops.flatMap((stop) => {
      const platforms = platformsOf(stop);
      const lat = platforms[0]?.lat ?? 0;
      return platformGroups(platforms, mergeRadiusMeters(zoomBucket(zoom), lat)).map((group) => {
        const [only] = group.platforms;
        const single = group.platforms.length === 1 && only !== undefined;
        const key = single ? selectionKey(stop.id, only.track) : stop.id;
        const selected = single
          ? key === selectedKey || stop.id === selectedKey
          : selectedStop === stop.id;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [group.lon, group.lat] },
          properties: {
            key,
            id: stop.id,
            track: single ? (only.track ?? "") : "",
            single,
            icon: markerId(group.modes, selected, dark),
            selected,
          },
        };
      });
    }),
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

/** Fahrzeuge als Punkte; Farbe der Linie, sonst des Verkehrsmittels */
function vehiclesToGeoJson(
  vehicles: readonly VehiclePosition[],
  selectedTrip: string | null,
): Collection {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [v.lon, v.lat] },
      properties: {
        trip: v.trip,
        line: v.line,
        color: v.color ? `#${v.color}` : MODE_HEX[v.mode],
        realtime: v.realtime,
        selected: v.trip === selectedTrip,
      },
    })),
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
  vehicles: Collection,
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
    type: "symbol",
    source: "abfahrt-stops",
    layout: {
      "icon-image": ["get", "icon"],
      // 22 px Marker: Zoom 14 → 11 px, 16 → 15 px, 18 → 22 px
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 16, 0.7, 18, 1],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "symbol-sort-key": ["case", ["get", "selected"], 1, 0],
      // Steig-Nummer im Punkt (herangezoomt, nur einzelne Steige)
      "text-field": ["step", ["zoom"], "", DETAIL_MIN_ZOOM + 0.5, ["get", "track"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "rgba(0,0,0,0.35)",
      "text-halo-width": 1,
    },
  });
  map.addLayer({
    id: "abfahrt-stop-labels",
    type: "symbol",
    source: "abfahrt-stop-names",
    minzoom: DETAIL_MIN_ZOOM,
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
  // Fahrzeuge über den Haltestellen; ohne Echtzeit etwas blasser
  map.addSource(VEHICLES_LAYER, { type: "geojson", data: vehicles });
  map.addLayer({
    id: VEHICLES_LAYER,
    type: "circle",
    source: VEHICLES_LAYER,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        ["case", ["get", "selected"], 11, 8],
        17,
        ["case", ["get", "selected"], 14, 11],
      ],
      "circle-color": ["get", "color"],
      "circle-opacity": ["case", ["get", "realtime"], 1, 0.7],
      "circle-stroke-color": ["case", ["get", "selected"], c.stroke, c.fill],
      "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
    },
  });
  map.addLayer({
    id: "abfahrt-vehicle-labels",
    type: "symbol",
    source: VEHICLES_LAYER,
    // Liniennummer immer im Kreis: so unterscheidet man Fahrzeuge von Steigen
    layout: {
      "text-field": ["get", "line"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 14, 7, 17, 10],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "rgba(0,0,0,0.35)",
      "text-halo-width": 1,
    },
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
  vehicles,
  selectedTrip,
  onSelectVehicle,
}: StopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /** Zoomstufe (halbe Stufen), für die die Punkte gerade gruppiert sind */
  const shownBucket = useRef(0);
  // Aktuelle Werte für die MapLibre-Ereignisse, ohne die Karte neu anzulegen
  const latest = useRef({
    stops,
    selectedKey,
    userPosition,
    dark,
    onViewChange,
    onSelect,
    vehicles,
    selectedTrip,
    onSelectVehicle,
  });
  latest.current = {
    stops,
    selectedKey,
    userPosition,
    dark,
    onViewChange,
    onSelect,
    vehicles,
    selectedTrip,
    onSelectVehicle,
  };

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
      const { vehicles: v, selectedTrip: trip } = latest.current;
      shownBucket.current = zoomBucket(map.getZoom());
      addOwnLayers(
        map,
        d,
        stopsToGeoJson(s, sel, map.getZoom(), d),
        namesToGeoJson(s),
        positionToGeoJson(me),
        vehiclesToGeoJson(v, trip),
      );
    });
    // Marker-Bilder bei Bedarf zeichnen (auch nach jedem Stilwechsel). Nur der Resolver kann
    // das Bild für die laufende Anfrage liefern, ein styleimagemissing-Listener käme zu spät.
    map.setMissingStyleImageResolver((id) => {
      const image = drawMarker(id);
      if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: MARKER_RATIO });
    });
    // Neu gruppieren, sobald sich die Zoomstufe merklich geändert hat
    map.on("zoomend", () => {
      const bucket = zoomBucket(map.getZoom());
      if (bucket === shownBucket.current) return;
      shownBucket.current = bucket;
      const { stops: s, selectedKey: sel, dark: d } = latest.current;
      void map
        .getSource<GeoJSONSource>("abfahrt-stops")
        ?.setData(stopsToGeoJson(s, sel, map.getZoom(), d));
    });
    map.on("load", () => latest.current.onViewChange(viewOf(map)));
    map.on("moveend", () => latest.current.onViewChange(viewOf(map)));
    map.on("click", (event) => {
      const { x, y } = event.point;
      const box: [[number, number], [number, number]] = [
        [x - TAP_TOLERANCE_PX, y - TAP_TOLERANCE_PX],
        [x + TAP_TOLERANCE_PX, y + TAP_TOLERANCE_PX],
      ];
      // Fahrzeuge liegen oben und haben Vorrang
      if (map.getLayer(VEHICLES_LAYER)) {
        const [car] = map.queryRenderedFeatures(box, { layers: [VEHICLES_LAYER] });
        const carProps: unknown = car?.properties;
        const trip =
          typeof carProps === "object" && carProps !== null && "trip" in carProps
            ? carProps.trip
            : null;
        const vehicle = latest.current.vehicles.find((v) => v.trip === trip);
        if (vehicle) {
          latest.current.onSelectVehicle(vehicle);
          return;
        }
      }
      const layers = map.getLayer(STOPS_LAYER) ? [STOPS_LAYER] : [];
      const hits: MapGeoJSONFeature[] =
        layers.length > 0 ? map.queryRenderedFeatures(box, { layers }) : [];
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
      // Zusammengefasste Steige öffnen die ganze Haltestelle, ein einzelner Steig nur sich
      const single =
        typeof props === "object" && props !== null && "single" in props && props.single === true;
      const platform =
        stop && single ? (platformsOf(stop).find((p) => (p.track ?? "") === track) ?? null) : null;
      latest.current.onSelect(stop ? { stop, platform } : null);
    });
    for (const layer of [STOPS_LAYER, VEHICLES_LAYER]) {
      map.on("mousemove", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Die Karte wird einmal angelegt, spätere Änderungen laufen über die Effekte unten
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource<GeoJSONSource>("abfahrt-stops");
    if (map) void source?.setData(stopsToGeoJson(stops, selectedKey, map.getZoom(), dark));
    const names = mapRef.current?.getSource<GeoJSONSource>("abfahrt-stop-names");
    void names?.setData(namesToGeoJson(stops));
  }, [stops, selectedKey, dark]);

  useEffect(() => {
    void mapRef.current
      ?.getSource<GeoJSONSource>(VEHICLES_LAYER)
      ?.setData(vehiclesToGeoJson(vehicles, selectedTrip));
  }, [vehicles, selectedTrip]);

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
