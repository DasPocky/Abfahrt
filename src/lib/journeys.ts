// Verbindungssuche: URL-Parameter und Anzeige-Hilfen (reine Funktionen, getestet)
import type { Journey, JourneyLeg } from "../../shared/api-types";

/** Gewählte Haltestelle (ID für die API, Name für die Anzeige) */
export interface PickedStop {
  id: string;
  name: string;
}

export interface JourneyQuery {
  from: PickedStop | null;
  to: PickedStop | null;
  /** ISO-8601; fehlt = jetzt */
  time?: string;
  /** true = `time` ist die gewünschte Ankunftszeit */
  arrive: boolean;
}

export const EMPTY_JOURNEY_QUERY: JourneyQuery = { from: null, to: null, arrive: false };

/** Namen der URL-Parameter (deutsch, teilbar) */
const PARAM = {
  from: "von",
  fromName: "vonName",
  to: "nach",
  toName: "nachName",
  time: "zeit",
  arrive: "ankunft",
} as const;

function stopFromParams(params: URLSearchParams, idKey: string, nameKey: string) {
  const id = params.get(idKey)?.trim();
  if (!id) return null;
  return { id, name: params.get(nameKey)?.trim() ?? "" };
}

export function journeyQueryFromParams(params: URLSearchParams): JourneyQuery {
  const time = params.get(PARAM.time);
  const parsed = time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : undefined;
  return {
    from: stopFromParams(params, PARAM.from, PARAM.fromName),
    to: stopFromParams(params, PARAM.to, PARAM.toName),
    ...(parsed ? { time: parsed } : {}),
    // Ankunft ohne Zeitpunkt ergibt keinen Sinn, dann gilt „ab jetzt“
    arrive: parsed !== undefined && params.get(PARAM.arrive) === "1",
  };
}

export function journeyQueryToParams(query: JourneyQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.from) {
    params.set(PARAM.from, query.from.id);
    if (query.from.name) params.set(PARAM.fromName, query.from.name);
  }
  if (query.to) {
    params.set(PARAM.to, query.to.id);
    if (query.to.name) params.set(PARAM.toName, query.to.name);
  }
  if (query.time) {
    params.set(PARAM.time, query.time);
    if (query.arrive) params.set(PARAM.arrive, "1");
  }
  return params;
}

/** Pfad der Verbindungssuche (relativ zum Router-basename) */
export function journeyPath(query: JourneyQuery = EMPTY_JOURNEY_QUERY): string {
  const search = journeyQueryToParams(query).toString();
  return search ? `/verbindung?${search}` : "/verbindung";
}

/** Start und Ziel vertauschen */
export function swapJourneyQuery(query: JourneyQuery): JourneyQuery {
  return { ...query, from: query.to, to: query.from };
}

/** Dauer kompakt: „42 Min“, „1 Std“, „1 Std 5 Min“ */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} Min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} Std` : `${hours} Std ${rest} Min`;
}

export function formatTransfers(transfers: number): string {
  if (transfers === 0) return "direkt";
  return transfers === 1 ? "1 Umstieg" : `${transfers} Umstiege`;
}

export interface JourneyTimes {
  plannedDeparture: string | null;
  realtimeDeparture: string | null;
  plannedArrival: string | null;
  realtimeArrival: string | null;
}

/** Abfahrt am Start und Ankunft am Ziel der ganzen Verbindung */
export function journeyTimes(journey: Journey): JourneyTimes {
  const first = journey.legs[0]?.origin;
  const last = journey.legs.at(-1)?.destination;
  return {
    plannedDeparture: first?.plannedDeparture ?? null,
    realtimeDeparture: first?.realtimeDeparture ?? null,
    plannedArrival: last?.plannedArrival ?? null,
    realtimeArrival: last?.realtimeArrival ?? null,
  };
}

/** Fällt eine Fahrt oder ein genutzter Halt aus, ist die Verbindung nicht fahrbar */
export function isLegCancelled(leg: JourneyLeg): boolean {
  return leg.cancelled || leg.origin.cancelled || leg.destination.cancelled;
}

export function isJourneyCancelled(journey: Journey): boolean {
  return journey.legs.some((leg) => leg.kind === "transit" && isLegCancelled(leg));
}
