// Kartenausschnitt → Anfrage an /api/stops/area (Grenzen wie im Worker, worker/stops-area.ts).
// Es geht nur der sichtbare Ausschnitt an den Worker, nicht der Standort.
import type { StopSearchResponse } from "../../shared/api-types";
import { getJson, isStopSearchResponse } from "@/lib/api";

/** Haltestellen erst ab dieser Zoomstufe laden (ca. 2–3 km Kartenbreite auf dem Handy) */
export const STOPS_MIN_ZOOM = 14;
/** Größter Ausschnitt, den der Worker annimmt (Grad), mit etwas Luft für die Rundung */
export const MAX_AREA_LAT = 0.048;
export const MAX_AREA_LON = 0.078;

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Area {
  /** „lat,lon“ der Südwest-Ecke */
  min: string;
  /** „lat,lon“ der Nordost-Ecke */
  max: string;
}

const down = (v: number) => (Math.floor(v * 1000) / 1000).toFixed(3);
const up = (v: number) => (Math.ceil(v * 1000) / 1000).toFixed(3);

/**
 * Ausschnitt für die Anfrage: ab STOPS_MIN_ZOOM, auf die erlaubte Größe um die Mitte beschnitten
 * (z. B. breite Desktop-Fenster) und nach außen auf 3 Nachkommastellen gerundet. Gleiche
 * Ausschnitte ergeben so denselben Schlüssel im Browser- und im Worker-Cache.
 */
export function areaForBounds(bounds: Bounds, zoom: number): Area | null {
  if (zoom < STOPS_MIN_ZOOM) return null;
  const midLat = (bounds.south + bounds.north) / 2;
  const midLon = (bounds.west + bounds.east) / 2;
  const halfLat = Math.min(bounds.north - bounds.south, MAX_AREA_LAT) / 2;
  const halfLon = Math.min(bounds.east - bounds.west, MAX_AREA_LON) / 2;
  if (!(halfLat > 0 && halfLon > 0)) return null;
  return {
    min: `${down(midLat - halfLat)},${down(midLon - halfLon)}`,
    max: `${up(midLat + halfLat)},${up(midLon + halfLon)}`,
  };
}

export function fetchStopsInArea(area: Area, signal?: AbortSignal): Promise<StopSearchResponse> {
  const params = new URLSearchParams({ min: area.min, max: area.max });
  return getJson(`stops/area?${params.toString()}`, isStopSearchResponse, signal);
}
