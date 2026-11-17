// Live-Fahrzeuge (#92): Abschnitte von /api/vehicles laden und die Position jedes Fahrzeugs aus
// der Zeit berechnen. Positionen sind geschätzt (Fahrplan/Echtzeit), kein Fahrzeug-GPS.
import type { TransportMode, VehicleSegment, VehiclesResponse } from "../../shared/api-types";
import { getJson } from "@/lib/api";
import type { Area } from "@/lib/map-area";

export function isVehiclesResponse(value: unknown): value is VehiclesResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "segments" in value &&
    Array.isArray(value.segments)
  );
}

export function fetchVehicles(area: Area, signal?: AbortSignal): Promise<VehiclesResponse> {
  const params = new URLSearchParams({ min: area.min, max: area.max });
  return getJson(`vehicles?${params.toString()}`, isVehiclesResponse, signal);
}

export interface VehiclePosition {
  trip: string;
  line: string;
  mode: TransportMode;
  color: string | null;
  lat: number;
  lon: number;
  realtime: boolean;
  delayMinutes: number | null;
  /** Nächster Halt (bzw. der Halt, an dem das Fahrzeug gerade steht) */
  nextStop: string;
  /** Steht gerade an einem Halt */
  atStop: boolean;
}

/** So lange vor der ersten Abfahrt zeigen wir ein Fahrzeug schon am Starthalt */
const SHOW_BEFORE_MS = 60_000;

/** Punkt bei Anteil `fraction` (0–1) der Strecke; Länge mit cos(Breite) gestaucht */
export function pointAlong(path: readonly [number, number][], fraction: number): [number, number] {
  const first = path[0];
  if (!first || path.length < 2) return first ?? [0, 0];
  const scale = Math.cos((first[0] * Math.PI) / 180);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [aLat, aLon] = path[i - 1]!;
    const [bLat, bLon] = path[i]!;
    const length = Math.hypot(bLat - aLat, (bLon - aLon) * scale);
    lengths.push(length);
    total += length;
  }
  let rest = Math.min(1, Math.max(0, fraction)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (rest <= length || i === lengths.length - 1) {
      const t = length === 0 ? 0 : Math.min(1, rest / length);
      const [aLat, aLon] = path[i]!;
      const [bLat, bLon] = path[i + 1]!;
      return [aLat + (bLat - aLat) * t, aLon + (bLon - aLon) * t];
    }
    rest -= length;
  }
  return path.at(-1)!;
}

function position(
  segment: VehicleSegment,
  [lat, lon]: [number, number],
  atStop: boolean,
  nextStop = segment.nextStop,
): VehiclePosition {
  return {
    trip: segment.trip,
    line: segment.line,
    mode: segment.mode,
    color: segment.color,
    lat,
    lon,
    realtime: segment.realtime,
    delayMinutes: segment.delayMinutes,
    nextStop,
    atStop,
  };
}

/**
 * Position aller Fahrzeuge zum Zeitpunkt `now`: im laufenden Abschnitt nach Zeitanteil, zwischen
 * zwei Abschnitten am Halt, kurz vor der ersten Abfahrt am Starthalt. Fahrten ohne passenden
 * Abschnitt (schon angekommen, noch lange nicht los) erscheinen nicht.
 */
export function vehiclePositions(
  segments: readonly VehicleSegment[],
  now: number,
): VehiclePosition[] {
  const byTrip = new Map<string, VehicleSegment[]>();
  for (const s of segments) {
    const list = byTrip.get(s.trip);
    if (list) list.push(s);
    else byTrip.set(s.trip, [s]);
  }
  const result: VehiclePosition[] = [];
  for (const list of byTrip.values()) {
    const sorted = list
      .map((s) => ({ s, dep: Date.parse(s.departure), arr: Date.parse(s.arrival) }))
      .toSorted((a, b) => a.dep - b.dep);
    const running = sorted.find(({ dep, arr }) => dep <= now && now < arr);
    if (running) {
      const span = running.arr - running.dep;
      const fraction = span > 0 ? (now - running.dep) / span : 1;
      result.push(position(running.s, pointAlong(running.s.path, fraction), false));
      continue;
    }
    const nextIndex = sorted.findIndex(({ dep }) => dep > now);
    const previous = nextIndex === -1 ? undefined : sorted[nextIndex - 1];
    const next = nextIndex === -1 ? undefined : sorted[nextIndex];
    if (previous && next) {
      // Hält zwischen zwei Abschnitten
      result.push(position(next.s, previous.s.path.at(-1)!, true, previous.s.nextStop));
    } else if (next && nextIndex === 0 && next.dep - now <= SHOW_BEFORE_MS) {
      result.push(position(next.s, next.s.path[0]!, true));
    }
  }
  return result;
}
