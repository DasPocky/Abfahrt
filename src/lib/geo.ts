// Entfernungen und Ranking der Suchtreffer nach Nähe. Läuft nur im Browser:
// der Standort verlässt das Gerät nicht.
import type { Stop } from "../../shared/api-types";

export interface Position {
  lat: number;
  lon: number;
}

/** Luftlinie in km (gleichwinklige Näherung, für Entfernungen in einer Region genau genug) */
export function distanceKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`;
  return `${Math.round(km)} km`;
}

/** Mittlere Passgenauigkeit, wenn die Quelle keine liefert (z. B. Transitous) */
const DEFAULT_RELEVANCE = 500;
/** Abzug für Entfernung: wächst logarithmisch, 2 km ≈ 120, 30 km ≈ 480 Punkte */
const DISTANCE_WEIGHT = 120;
/** Treffer ohne Koordinaten gelten als weit weg */
const UNKNOWN_DISTANCE_KM = 200;

export function stopScore(stop: Stop, position: Position): number {
  const km =
    stop.lat !== undefined && stop.lon !== undefined
      ? distanceKm(position, { lat: stop.lat, lon: stop.lon })
      : UNKNOWN_DISTANCE_KM;
  return (stop.relevance ?? DEFAULT_RELEVANCE) - DISTANCE_WEIGHT * Math.log2(1 + km / 2);
}

export interface RankedStop {
  stop: Stop;
  distanceKm: number | null;
}

/** Ohne Standort: Reihenfolge der Quelle. Mit Standort: Passgenauigkeit und Nähe kombiniert. */
export function rankStops(
  stops: readonly Stop[],
  position: Position | null,
  limit = 10,
): RankedStop[] {
  const ranked = stops.map((stop) => ({
    stop,
    distanceKm:
      position && stop.lat !== undefined && stop.lon !== undefined
        ? distanceKm(position, { lat: stop.lat, lon: stop.lon })
        : null,
    score: position ? stopScore(stop, position) : 0,
  }));
  const ordered = position ? ranked.toSorted((a, b) => b.score - a.score) : ranked;
  return ordered.slice(0, limit).map(({ stop, distanceKm: km }) => ({ stop, distanceKm: km }));
}
