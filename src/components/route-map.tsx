// MapLibre-Karte mit dem Verlauf einer Verbindung. Nur über src/components/lazy-route-map.tsx
// einbinden, damit MapLibre nicht im Haupt-Bundle landet.
import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import { MAP_LOCALE, mapStyle, simplifyBaseMap } from "@/components/map-base";
import type { RouteData } from "@/lib/route-map";

/** Rand um die Route beim Einpassen (Platz für Zoomknöpfe, Namen unter den Punkten, Quellhinweis) */
const FIT_PADDING = { top: 28, bottom: 44, left: 28, right: 52 };
/** Kurze Fußwege nicht bis auf Hausnummern heranzoomen */
const FIT_MAX_ZOOM = 16;

const COLORS = {
  light: {
    casing: "#ffffff",
    fill: "#ffffff",
    stroke: "#171717",
    text: "#171717",
    halo: "#ffffff",
  },
  dark: { casing: "#0a0a0a", fill: "#262626", stroke: "#fafafa", text: "#fafafa", halo: "#0a0a0a" },
};

/** Eigene Quellen und Ebenen; nach jedem Stilwechsel (hell/dunkel) neu anlegen */
function addRouteLayers(map: MapLibreMap, dark: boolean, data: RouteData) {
  const c = dark ? COLORS.dark : COLORS.light;
  map.addSource("route-lines", { type: "geojson", data: data.lines });
  map.addSource("route-points", { type: "geojson", data: data.points });
  // Rand unter den Fahrten, damit auch dunkle Linienfarben auf dunkler Karte sichtbar bleiben
  map.addLayer({
    id: "route-casing",
    type: "line",
    source: "route-lines",
    filter: ["!", ["get", "walk"]],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": c.casing, "line-width": 7 },
  });
  map.addLayer({
    id: "route-transit",
    type: "line",
    source: "route-lines",
    filter: ["!", ["get", "walk"]],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 4.5 },
  });
  map.addLayer({
    id: "route-walk",
    type: "line",
    source: "route-lines",
    filter: ["get", "walk"],
    layout: { "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3, "line-dasharray": [1.2, 1.2] },
  });
  map.addLayer({
    id: "route-points",
    type: "circle",
    source: "route-points",
    paint: {
      "circle-radius": ["match", ["get", "kind"], "transfer", 4.5, 6.5],
      "circle-color": ["match", ["get", "kind"], "transfer", c.fill, c.stroke],
      "circle-stroke-color": ["match", ["get", "kind"], "transfer", c.stroke, c.fill],
      "circle-stroke-width": 2.5,
    },
  });
  map.addLayer({
    id: "route-labels",
    type: "symbol",
    source: "route-points",
    filter: ["!=", ["get", "kind"], "transfer"],
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.8],
      "text-max-width": 10,
      "text-optional": true,
    },
    paint: { "text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 1.5 },
  });
}

interface RouteMapProps {
  data: RouteData;
  dark: boolean;
  /** Vorlesetext der Karte, z. B. „Routenkarte von A nach B“ */
  label: string;
}

export function RouteMap({ data, dark, label }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ data, dark });
  latest.current = { data, dark };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const { bounds } = latest.current.data;
    const map = new MapLibreMap({
      container,
      style: mapStyle(latest.current.dark),
      locale: { ...MAP_LOCALE, "Map.Title": label },
      ...(bounds
        ? { bounds, fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM } }
        : { center: [6.7775, 51.2255] as [number, number], zoom: 10 }),
      maxZoom: 19,
      // Quellhinweis steht unter der Karte (deutsch, immer sichtbar)
      attributionControl: false,
      // Eingebettet in die Liste: Seite scrollt mit einem Finger, Karte mit zwei bzw. Strg
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.on("style.load", () => {
      simplifyBaseMap(map);
      addRouteLayers(map, latest.current.dark, latest.current.data);
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
    // Die Karte wird einmal angelegt, spätere Änderungen laufen über die Effekte unten
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    void map?.getSource<GeoJSONSource>("route-lines")?.setData(data.lines);
    void map?.getSource<GeoJSONSource>("route-points")?.setData(data.points);
  }, [data]);

  const styleRef = useRef(dark);
  useEffect(() => {
    if (styleRef.current === dark) return;
    styleRef.current = dark;
    mapRef.current?.setStyle(mapStyle(dark), { diff: false });
  }, [dark]);

  // Die Zeichenfläche selbst ist der benannte, per Tab erreichbare Bereich („Map.Title“):
  // Pfeiltasten verschieben, +/- zoomen
  return <div ref={containerRef} className="size-full" />;
}
