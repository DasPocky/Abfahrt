import type { TransportMode, VehicleSegment } from "../../shared/api-types";
import { decodePolyline, simplifyPath } from "../geometry";
import { fetchJson } from "../http";
import { normalizeHex } from "../line-colors";
import { stripCityPrefix } from "../stop-names";
import { MODE_MAP } from "./transitous";
import type { Area } from "./transitous-map";

// Fahrzeuge im Kartenausschnitt über Transitous `v5/map/trips` (#92), siehe docs/01-datenquellen.md
const BASE = "https://api.transitous.org/api";

/** Ein Abschnitt aus `v5/map/trips` (getestet 17.11.2026) */
export interface TransitousTripSegment {
  trips?: { tripId?: string; displayName?: string }[];
  routeColor?: string;
  mode?: string;
  departure?: string;
  arrival?: string;
  scheduledDeparture?: string;
  realTime?: boolean;
  /** Encoded Polyline, Präzision 5 */
  polyline?: string;
  to?: { name?: string };
}

/** Höchstens so viele Punkte je Abschnitt (die App rechnet jede Sekunde damit) */
export const MAX_VEHICLE_PATH_POINTS = 40;
/** Höchstens so viele Abschnitte je Antwort */
export const MAX_SEGMENTS = 1500;

function minutesBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / 60_000);
}

/** Abschnitt für die App; Flugzeuge, Unbekanntes und Abschnitte ohne Verlauf fallen weg */
export function toVehicleSegment(segment: TransitousTripSegment): VehicleSegment | null {
  const mode: TransportMode | undefined = MODE_MAP[segment.mode ?? ""];
  const trip = segment.trips?.[0];
  const { departure, arrival } = segment;
  if (!mode || !trip?.tripId || !departure || !arrival) return null;
  if (!(Date.parse(arrival) >= Date.parse(departure))) return null;
  const path = simplifyPath(decodePolyline(segment.polyline ?? "", 5), MAX_VEHICLE_PATH_POINTS);
  if (path.length < 2) return null;
  const realtime = segment.realTime === true;
  return {
    trip: trip.tripId,
    line: trip.displayName?.trim() || "?",
    mode,
    color: normalizeHex(segment.routeColor),
    departure,
    arrival,
    realtime,
    delayMinutes:
      realtime && segment.scheduledDeparture
        ? minutesBetween(departure, segment.scheduledDeparture)
        : null,
    nextStop: stripCityPrefix(segment.to?.name ?? ""),
    path,
  };
}

export async function vehiclesInArea(area: Area, from: Date, to: Date): Promise<VehicleSegment[]> {
  const params = new URLSearchParams({
    min: `${area.minLat},${area.minLon}`,
    max: `${area.maxLat},${area.maxLon}`,
    // Pflichtangabe; im kleinen Ausschnitt liefert MOTIS bei jedem Zoom dieselben Fahrten (getestet)
    zoom: "16",
    startTime: from.toISOString(),
    endTime: to.toISOString(),
  });
  const data = await fetchJson<TransitousTripSegment[]>(
    "transitous",
    `${BASE}/v5/map/trips?${params.toString()}`,
  );
  return (Array.isArray(data) ? data : [])
    .map(toVehicleSegment)
    .filter((s) => s !== null)
    .slice(0, MAX_SEGMENTS);
}
