import type { Departure, Stop, TransportMode } from "../../shared/api-types";
import { fetchJson } from "../http";
import { normalizeHex, normalizeLineName, type LineColorMap } from "../line-colors";

// Transitous (MOTIS 2), siehe docs/01-datenquellen.md – nur leichte, gecachte Nutzung.
const BASE = "https://api.transitous.org/api";

const MODE_MAP: Record<string, TransportMode> = {
  TRAM: "tram",
  SUBWAY: "subway",
  BUS: "bus",
  COACH: "bus",
  SUBURBAN: "suburban",
  RAIL: "regional",
  REGIONAL_RAIL: "regional",
  REGIONAL_FAST_RAIL: "regional",
  HIGHSPEED_RAIL: "longdistance",
  LONG_DISTANCE: "longdistance",
  NIGHT_RAIL: "longdistance",
  FERRY: "ferry",
};

interface TransitousPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  areas?: { name?: string; adminLevel?: number }[];
}

interface TransitousStopTime {
  mode?: string;
  displayName?: string;
  routeShortName?: string;
  headsign?: string;
  routeColor?: string;
  routeTextColor?: string;
  realTime?: boolean;
  cancelled?: boolean;
  tripCancelled?: boolean;
  place: {
    name?: string;
    departure?: string;
    scheduledDeparture?: string;
    track?: string;
    scheduledTrack?: string;
    cancelled?: boolean;
  };
}

function toStop(p: TransitousPlace): Stop {
  const place = p.areas?.find((a) => a.name && a.name !== "Deutschland" && a.name !== p.name);
  return { id: `transitous:${p.id}`, name: p.name, place: place?.name, lat: p.lat, lon: p.lon };
}

export async function searchStops(query: string): Promise<Stop[]> {
  const url = `${BASE}/v1/geocode?type=STOP&language=de&text=${encodeURIComponent(query)}`;
  const data = await fetchJson<TransitousPlace[]>("transitous", url);
  return data.slice(0, 10).map(toStop);
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const x = (bLon - aLon) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Abstand-Aufschlag für Treffer außerhalb des deutschlandweiten DELFI-Datensatzes (in m) */
const NON_DELFI_PENALTY_M = 150;
const MAX_MATCH_DISTANCE_M = 500;

/**
 * Wählt die Transitous-Haltestelle zu einer VRR-Haltestelle. Bevorzugt die exakte amtliche
 * Haltestellen-ID (DHID, z. B. „de-DELFI_de:05111:18249“ zu „de:05111:18249“), danach einen
 * Steig derselben Haltestelle, zuletzt den nächsten Treffer im Umkreis (DELFI bevorzugt).
 * Hintergrund: Bei „Bilk S“ lag der Bahnhof aus einem anderen Datensatz näher, dort fehlen
 * die Rheinbahn-Linien und damit die Linienfarben.
 */
export function pickMatchingStop(
  candidates: readonly TransitousPlace[],
  stop: { lat: number; lon: number },
  dhid: string | null,
): string | null {
  if (dhid) {
    const exact = candidates.find((c) => c.id === dhid || c.id.endsWith(`_${dhid}`));
    if (exact) return exact.id;
    const platform = candidates.find((c) => c.id.includes(`_${dhid}:`));
    if (platform) return platform.id;
  }
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const dist = distanceMeters(stop.lat, stop.lon, c.lat, c.lon);
    if (dist > MAX_MATCH_DISTANCE_M) continue;
    const score = dist + (c.id.startsWith("de-DELFI_") ? 0 : NON_DELFI_PENALTY_M);
    if (!best || score < best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

/** Findet die Transitous-Haltestelle zu einer Haltestelle aus einer anderen Quelle. */
export async function findMatchingStop(stop: Stop): Promise<string | null> {
  if (stop.lat === undefined || stop.lon === undefined) return null;
  const position = { lat: stop.lat, lon: stop.lon };
  const dhid = stop.id.startsWith("vrr:") ? stop.id.slice("vrr:".length) : null;
  // Erst nur der Name (findet die DHID am zuverlässigsten), dann mit Ort
  const texts = [stop.name];
  if (stop.place && !stop.name.includes(stop.place)) texts.push(`${stop.name} ${stop.place}`);
  const seen: TransitousPlace[] = [];
  for (const text of texts) {
    const url = `${BASE}/v1/geocode?type=STOP&language=de&text=${encodeURIComponent(text)}&place=${stop.lat},${stop.lon}`;
    seen.push(...(await fetchJson<TransitousPlace[]>("transitous", url)));
    const exact = dhid ? pickMatchingStop(seen, position, dhid) : null;
    if (exact && (exact.endsWith(`_${dhid}`) || exact.includes(`_${dhid}:`))) return exact;
  }
  return pickMatchingStop(seen, position, dhid);
}

export function toDeparture(st: TransitousStopTime, index: number): Departure | null {
  const planned = st.place.scheduledDeparture;
  if (!planned) return null;
  const line = st.displayName ?? st.routeShortName ?? "?";
  const platform = st.place.track ?? null;
  const plannedPlatform = st.place.scheduledTrack ?? null;
  return {
    id: `${index}-${line}-${planned}`,
    line,
    mode: MODE_MAP[st.mode ?? ""] ?? "other",
    direction: st.headsign ?? "",
    plannedTime: planned,
    realtimeTime: st.realTime ? (st.place.departure ?? planned) : null,
    platform,
    plannedPlatform: plannedPlatform !== platform ? plannedPlatform : null,
    cancelled: Boolean(st.cancelled || st.tripCancelled || st.place.cancelled),
    lineColor: st.routeColor ?? null,
    lineTextColor: st.routeTextColor ?? null,
    notices: [],
  };
}

export async function departures(
  transitousId: string,
  when?: Date,
): Promise<{ stopName: string | null; departures: Departure[] }> {
  let url = `${BASE}/v5/stoptimes?n=80&stopId=${encodeURIComponent(transitousId)}`;
  if (when) url += `&time=${encodeURIComponent(when.toISOString())}`;
  const data = await fetchJson<{ stopTimes?: TransitousStopTime[] }>("transitous", url);
  const stopTimes = data.stopTimes ?? [];
  return {
    stopName: stopTimes[0]?.place.name ?? null,
    departures: stopTimes.map(toDeparture).filter((d): d is Departure => d !== null),
  };
}

/**
 * Stichzeitpunkt für die Farbzuordnung: der nächste Werktag um 11:00 UTC (Mittag in Berlin).
 * So fahren möglichst alle Linien, auch wenn die Zuordnung nachts oder am Wochenende entsteht.
 */
export function colorSampleTime(now: Date): Date {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11));
  while (t.getTime() <= now.getTime() || t.getUTCDay() === 0 || t.getUTCDay() === 6) {
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return t;
}

/** Linie → Farbe aus Transitous-Abfahrten; nur Einträge mit gültiger Farbe, erster Treffer gilt. */
export function lineColorsFromStopTimes(stopTimes: readonly TransitousStopTime[]): LineColorMap {
  const colors: LineColorMap = {};
  for (const st of stopTimes) {
    const color = normalizeHex(st.routeColor);
    if (color === null) continue;
    const entry = { color, textColor: normalizeHex(st.routeTextColor) };
    for (const name of [st.routeShortName, st.displayName]) {
      if (!name) continue;
      const key = normalizeLineName(name);
      if (key && !(key in colors)) colors[key] = entry;
    }
  }
  return colors;
}

/**
 * Farbzuordnung der Linien an einer Transitous-Haltestelle. Eine Abfrage (ca. 30 min Fahrplan um
 * die Mittagszeit), das Ergebnis cached der Aufrufer lange.
 */
export async function lineColors(transitousId: string, now = new Date()): Promise<LineColorMap> {
  const time = colorSampleTime(now).toISOString();
  const url = `${BASE}/v5/stoptimes?n=40&window=1800&stopId=${encodeURIComponent(transitousId)}&time=${encodeURIComponent(time)}`;
  const data = await fetchJson<{ stopTimes?: TransitousStopTime[] }>("transitous", url);
  return lineColorsFromStopTimes(data.stopTimes ?? []);
}
