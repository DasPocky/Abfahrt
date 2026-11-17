// Etappen-Suche bei mehreren Zwischenhalten (#110): Zeiten der gewählten Verbindungen
import type { Journey } from "../../shared/api-types";

/** Ankunft am Ziel einer Verbindung (Echtzeit, sonst Plan) in ms */
export function arrivalOf(journey: Journey): number {
  const d = journey.legs.at(-1)?.destination;
  return Date.parse(d?.realtimeArrival ?? d?.plannedArrival ?? "");
}

/** Abfahrt am Start einer Verbindung (Echtzeit, sonst Plan) in ms */
export function departureOf(journey: Journey): number {
  const o = journey.legs[0]?.origin;
  return Date.parse(o?.realtimeDeparture ?? o?.plannedDeparture ?? "");
}

/** Start der nächsten Etappe: Ankunft plus Aufenthalt */
export function nextLegStart(journey: Journey, stayMinutes: number): string | undefined {
  const arrival = arrivalOf(journey);
  return Number.isNaN(arrival) ? undefined : new Date(arrival + stayMinutes * 60_000).toISOString();
}
