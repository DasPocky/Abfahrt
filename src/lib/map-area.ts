// Kartenausschnitt → Anfrage an /api/stops/area (Grenzen wie im Worker, worker/stops-area.ts).
// Es geht nur der sichtbare Ausschnitt an den Worker, nicht der Standort.
import type { StopPlatform, StopSearchResponse, TransportMode } from "../../shared/api-types";
import { getJson, isStopSearchResponse } from "@/lib/api";
import { MODE_LABEL, platformLabel } from "@/lib/modes";

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

/** Schlüssel eines Steigs auf der Karte: „<Haltestellen-ID>|<Steig>“, ohne Steig nur die ID */
export function selectionKey(stopId: string, track: string | null): string {
  return track === null ? stopId : `${stopId}|${track}`;
}

/** „Steig 1 · U-Bahn, Straßenbahn“ für das Kärtchen eines Steigs (#84) */
export function platformSummary(platform: StopPlatform): string {
  const label = platformLabel(platform.modes[0] ?? "other");
  const modes = platform.modes.map((m) => MODE_LABEL[m]).join(", ");
  return [platform.track ? `${label} ${platform.track}` : null, modes || null]
    .filter(Boolean)
    .join(" · ");
}

/** Abfahrten der Haltestelle, mit Steig gefiltert auf diesen Steig */
export function platformDeparturesPath(stopPath: string, platform: StopPlatform | null): string {
  return platform?.track ? `${stopPath}?gleis=${encodeURIComponent(platform.track)}` : stopPath;
}

/** Steige bis zu diesem Abstand (Meter) gelten herausgezoomt als ein Punkt (#86) */
export const PLATFORM_GROUP_RADIUS_M = 60;

const MODE_RANK: TransportMode[] = [
  "longdistance",
  "regional",
  "suburban",
  "subway",
  "tram",
  "bus",
  "ferry",
  "other",
];

export interface PlatformGroup {
  lat: number;
  lon: number;
  /** Verkehrsmittel der Gruppe, wichtigstes zuerst */
  modes: TransportMode[];
  platforms: StopPlatform[];
}

function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/**
 * Herausgezoomt: nahe beieinanderliegende Steige zu Gruppen zusammenfassen (Kette über
 * PLATFORM_GROUP_RADIUS_M). Liegen Steige sichtbar auseinander (z. B. Auf der Hardt: U73 unten,
 * U83/709 oben), entstehen mehrere Gruppen und damit mehrere Punkte.
 */
export function platformGroups(
  platforms: readonly StopPlatform[],
  radiusM = PLATFORM_GROUP_RADIUS_M,
): PlatformGroup[] {
  const groups: StopPlatform[][] = [];
  for (const platform of platforms) {
    const near = groups.filter((g) => g.some((p) => metersBetween(p, platform) <= radiusM));
    const merged = [...near.flat(), platform];
    for (const g of near) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups.map((g) => ({
    lat: g.reduce((sum, p) => sum + p.lat, 0) / g.length,
    lon: g.reduce((sum, p) => sum + p.lon, 0) / g.length,
    modes: [...new Set(g.flatMap((p) => p.modes))].toSorted(
      (a, b) => MODE_RANK.indexOf(a) - MODE_RANK.indexOf(b),
    ),
    platforms: g,
  }));
}
