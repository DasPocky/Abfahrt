// Kartenausschnitt → Anfrage an /api/stops/area (Grenzen wie im Worker, worker/stops-area.ts).
// Es geht nur der sichtbare Ausschnitt an den Worker, nicht der Standort.
import type { Stop, StopPlatform, StopSearchResponse, TransportMode } from "../../shared/api-types";
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

/** Feste Kacheln für Haltestellen (#98): 0,04° × 0,06° (ca. 4,4 × 4,2 km), in Tausendstel Grad */
export const TILE_LAT_MILLI = 40;
export const TILE_LON_MILLI = 60;

const milli = (v: number) => (v / 1000).toFixed(3);

/**
 * Kacheln, die den sichtbaren Ausschnitt abdecken (ab STOPS_MIN_ZOOM, Ausschnitt wie bei
 * `areaForBounds` auf die erlaubte Größe beschnitten). Gleiche Kachel = gleiche Anfrage, dadurch
 * greifen Worker- und Browser-Cache beim Verschieben und Zurückschieben.
 */
export function tilesForBounds(bounds: Bounds, zoom: number): Area[] | null {
  const area = areaForBounds(bounds, zoom);
  if (!area) return null;
  const [south = 0, west = 0] = area.min.split(",").map(Number);
  const [north = 0, east = 0] = area.max.split(",").map(Number);
  const i0 = Math.floor(Math.round(south * 1000) / TILE_LAT_MILLI);
  const i1 = Math.ceil(Math.round(north * 1000) / TILE_LAT_MILLI) - 1;
  const j0 = Math.floor(Math.round(west * 1000) / TILE_LON_MILLI);
  const j1 = Math.ceil(Math.round(east * 1000) / TILE_LON_MILLI) - 1;
  const tiles: Area[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      tiles.push({
        min: `${milli(i * TILE_LAT_MILLI)},${milli(j * TILE_LON_MILLI)}`,
        max: `${milli((i + 1) * TILE_LAT_MILLI)},${milli((j + 1) * TILE_LON_MILLI)}`,
      });
    }
  }
  return tiles;
}

/**
 * Haltestelle aus zwei Kacheln zusammenführen: Liegt eine Haltestelle auf der Kachelgrenze, liefert
 * jede Kachel nur die Steige auf ihrer Seite. Steige gleicher Nummer zählen einmal.
 */
function platformKey(p: StopPlatform): string {
  return p.track ?? `${p.lat},${p.lon}`;
}

export function mergeStop(a: Stop, b: Stop): Stop {
  if (!a.platforms || !b.platforms) return b.platforms ? b : a;
  const platforms = new Map(a.platforms.map((p) => [platformKey(p), p]));
  for (const p of b.platforms) platforms.set(platformKey(p), p);
  return { ...b, platforms: [...platforms.values()] };
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

/**
 * Steige, die auf dem Bildschirm näher als so viele Pixel beieinanderliegen, werden ein Punkt
 * (#86): etwa ein Markerdurchmesser, d. h. erst wenn man sie ohnehin nicht mehr getrennt sieht.
 */
export const PLATFORM_MERGE_PX = 16;

/** Meter je Bildschirmpixel bei dieser Zoomstufe und Breite (MapLibre: 512-px-Kacheln) */
export function metersPerPixel(zoom: number, lat: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** Abstand in Metern, unter dem Steige bei dieser Zoomstufe zusammengefasst werden */
export function mergeRadiusMeters(zoom: number, lat: number, px = PLATFORM_MERGE_PX): number {
  return px * metersPerPixel(zoom, lat);
}

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
 * Steige zu Gruppen zusammenfassen, die näher als `radiusM` beieinanderliegen (Kette). Mit
 * `mergeRadiusMeters` hängt das von der Zoomstufe ab: Steige, die man auf der Karte getrennt
 * sieht (z. B. Auf der Hardt: U73 unten, U83/709 oben), bleiben getrennte Punkte.
 */
export function platformGroups(
  platforms: readonly StopPlatform[],
  radiusM: number,
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
