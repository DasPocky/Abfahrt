// Gemeinsame MapLibre-Einrichtung für Stopp- und Routenkarte. Nur aus lazy geladenen Modulen
// importieren, damit MapLibre (ca. 1 MB) nicht im Haupt-Bundle landet.
import { setWorkerUrl } from "maplibre-gl";
// Eigene Datei statt Blob: Der Worker kommt von der eigenen Origin, das erlaubt `worker-src 'self'`.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(workerUrl);

/** Kartenstile von OpenFreeMap (OSM-Vektorkacheln, ohne Key), siehe docs/01-datenquellen.md */
export const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function mapStyle(dark: boolean): string {
  return dark ? MAP_STYLES.dark : MAP_STYLES.light;
}

/** Deutsche Texte für die MapLibre-Bedienelemente (Vorlesen, Hilfetexte) */
export const MAP_LOCALE = {
  "Map.Title": "Karte",
  "NavigationControl.ZoomIn": "Vergrößern",
  "NavigationControl.ZoomOut": "Verkleinern",
  "NavigationControl.ResetBearing": "Nach Norden ausrichten",
  "CooperativeGesturesHandler.WindowsHelpText": "Strg + Scrollen zoomt die Karte",
  "CooperativeGesturesHandler.MacHelpText": "⌘ + Scrollen zoomt die Karte",
  "CooperativeGesturesHandler.MobileHelpText": "Karte mit zwei Fingern bewegen",
};
