import type { Stop } from "../../shared/api-types";
import { fetchJson } from "../http";
import { isVrrArea } from "./vrr";

// Haltestellen im Kartenausschnitt über Transitous `v1/map/stops`, siehe docs/01-datenquellen.md
const BASE = "https://api.transitous.org/api";

/** Ein Eintrag aus `v1/map/stops`: meist ein einzelner Steig/Bahnsteig, nicht die Haltestelle */
export interface TransitousMapStop {
  name: string;
  stopId: string;
  parentId?: string;
  lat: number;
  lon: number;
  importance?: number;
}

export interface Area {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** Höchstens so viele Haltestellen pro Antwort (die wichtigsten zuerst) */
export const MAX_AREA_STOPS = 300;
/** Einträge ohne amtliche ID (z. B. Flixbus, Nachbarländer) in diesem Umkreis einer DHID-Haltestelle gelten als doppelt */
const DUPLICATE_RADIUS_M = 300;

/** Amtliche Haltestellen-ID (DHID) am Anfang der Quell-ID, z. B. „de:05111:18036“ */
const DHID = /^[a-z]{2}:\d{5}:\d+/;

/**
 * DHID der Haltestelle aus einer Transitous-ID, auch aus Steigen und anderen Datensätzen:
 * „de-DELFI_de:05111:18036:8:4“ → „de:05111:18036“.
 */
export function dhidOf(transitousId: string): string | null {
  const raw = transitousId.slice(transitousId.indexOf("_") + 1);
  return DHID.exec(raw)?.[0] ?? null;
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const x = (bLon - aLon) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

function mostCommon(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? "";
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v;
  return best;
}

interface Group {
  dhid: string | null;
  members: TransitousMapStop[];
}

/** Transitous-ID für Abfahrten einer Gruppe: möglichst die Haltestelle selbst aus DELFI */
function transitousIdOf(group: Group, preferred: readonly TransitousMapStop[]): string {
  const ids = preferred.flatMap((m) => (m.parentId ? [m.parentId, m.stopId] : [m.stopId]));
  if (group.dhid) {
    const exact = ids.find((id) => id === `de-DELFI_${group.dhid}`);
    if (exact) return exact;
  }
  const first = preferred[0] ?? group.members[0];
  return first?.parentId ?? first?.stopId ?? "";
}

type AreaStop = Stop & { lat: number; lon: number; importance: number };

/**
 * Entfernt das Städtekürzel aus DELFI-Namen („D-Heinrich-Heine-Allee U“ → „Heinrich-Heine-Allee U“,
 * „DU-Meiderich Süd Bf“ → „Meiderich Süd Bf“). „S-Bahnhof …“ und ähnliche bleiben unverändert.
 */
export function stripCityPrefix(name: string): string {
  return name.replace(/^[A-ZÄÖÜ]{1,3}-(?!Bahn)(?=[A-ZÄÖÜ0-9])/u, "");
}

function toStop(group: Group): AreaStop {
  const delfi = group.members.filter((m) => m.stopId.startsWith("de-DELFI_"));
  const preferred = delfi.length > 0 ? delfi : group.members;
  const lat = preferred.reduce((sum, m) => sum + m.lat, 0) / preferred.length;
  const lon = preferred.reduce((sum, m) => sum + m.lon, 0) / preferred.length;
  // Im VRR-Gebiet die VRR-ID: Antippen führt dann zur sekundengenauen VRR-Echtzeit
  const id =
    group.dhid && isVrrArea(group.dhid)
      ? `vrr:${group.dhid}`
      : `transitous:${transitousIdOf(group, preferred)}`;
  return {
    id,
    name: stripCityPrefix(mostCommon(preferred.map((m) => m.name))),
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    importance: Math.max(0, ...group.members.map((m) => m.importance ?? 0)),
  };
}

/**
 * Fasst die Steige aus `v1/map/stops` zu Haltestellen zusammen: nach DHID (auch über Datensätze
 * hinweg), sonst nach Eltern-ID. Name und Lage kommen bevorzugt aus DELFI. Einträge ohne DHID
 * nahe einer DHID-Haltestelle (z. B. „Köln Hbf“ aus niederländischen oder Flixbus-Daten) fallen
 * weg. Sortiert nach Bedeutung, höchstens MAX_AREA_STOPS.
 */
export function groupMapStops(entries: readonly TransitousMapStop[]): Stop[] {
  const groups = new Map<string, Group>();
  for (const entry of entries) {
    const dhid = dhidOf(entry.parentId ?? entry.stopId) ?? dhidOf(entry.stopId);
    const key = dhid ?? entry.parentId ?? entry.stopId;
    const group = groups.get(key);
    if (group) group.members.push(entry);
    else groups.set(key, { dhid, members: [entry] });
  }
  const stops = [...groups.values()].map((g) => ({ dhid: g.dhid, stop: toStop(g) }));
  const official = stops.filter((s) => s.dhid !== null).map((s) => s.stop);
  return stops
    .filter(
      ({ dhid, stop }) =>
        dhid !== null ||
        !official.some(
          (o) => distanceMeters(stop.lat, stop.lon, o.lat, o.lon) < DUPLICATE_RADIUS_M,
        ),
    )
    .map((s) => s.stop)
    .toSorted((a, b) => b.importance - a.importance || a.name.localeCompare(b.name, "de"))
    .slice(0, MAX_AREA_STOPS)
    .map(({ importance: _importance, ...stop }) => stop);
}

export async function stopsInArea(area: Area): Promise<Stop[]> {
  const url = `${BASE}/v1/map/stops?min=${area.minLat},${area.minLon}&max=${area.maxLat},${area.maxLon}`;
  const data = await fetchJson<TransitousMapStop[]>("transitous", url);
  return groupMapStops(Array.isArray(data) ? data : []);
}
