// Wofür ein Push-Abo Nachrichten bekommt (#72). Die App schickt das an den Worker, der es beim
// Abo speichert; ohne Personenbezug (Haltestellen-IDs, Linien, eine gemerkte Verbindung).
import {
  journeyOptionsFromParams,
  journeyOptionsToParams,
  type JourneyOptions,
} from "./journey-options";

export const MAX_TOPIC_STOPS = 10;
const MAX_LINES = 20;
const STOP_ID = /^vrr:[A-Za-z0-9:_.-]{1,160}$/;
const PLACE_ID =
  /^((vrr|transitous):[A-Za-z0-9:_.-]{1,160}|geo:-?\d{1,2}\.\d{1,6},-?\d{1,3}\.\d{1,6})$/;
const LINE = /^[\p{L}\d ._-]{1,16}$/u;

export interface PushStopTopic {
  /** Haltestelle (nur VRR, dort gibt es Störungsmeldungen) */
  id: string;
  name: string;
  /** Linien aus dem Filter des Favoriten; leer = nur Meldungen zur Haltestelle selbst */
  lines: string[];
}

export interface PushTripTopic {
  from: string;
  to: string;
  /** Anzeige, z. B. „Holthausen → Essen Hbf“ */
  label: string;
  options: JourneyOptions;
  /** Wiedererkennung der Verbindung (shared/transfers.ts journeySignature) */
  signature: string;
  /** ISO-8601, geplante Abfahrt und Ankunft */
  departure: string;
  arrival: string;
}

export interface PushTopics {
  /** Neue Störungen bei Favoriten */
  alerts: boolean;
  stops: PushStopTopic[];
  /** Gemerkte Fahrt live begleiten */
  trip: PushTripTopic | null;
  /** Ruhezeit 22–6 Uhr für Störungsmeldungen (die gemerkte Fahrt meldet sich trotzdem) */
  quiet: boolean;
}

export const EMPTY_PUSH_TOPICS: PushTopics = { alerts: false, stops: [], trip: null, quiet: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

function iso(value: unknown): string | null {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

function parseStop(value: unknown): PushStopTopic | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 170);
  const name = text(value.name, 120);
  if (!id || !STOP_ID.test(id) || name === null || !Array.isArray(value.lines)) return null;
  const lines = value.lines.filter((l): l is string => typeof l === "string" && LINE.test(l));
  if (lines.length !== value.lines.length || lines.length > MAX_LINES) return null;
  return { id, name, lines };
}

function parseTrip(value: unknown): PushTripTopic | null {
  if (!isRecord(value)) return null;
  const from = text(value.from, 170);
  const to = text(value.to, 170);
  const label = text(value.label, 200);
  const signature = text(value.signature, 2000);
  const departure = iso(value.departure);
  const arrival = iso(value.arrival);
  const options = journeyOptionsFromParams(
    new URLSearchParams(typeof value.options === "string" ? value.options : ""),
  );
  if (!from || !to || !PLACE_ID.test(from) || !PLACE_ID.test(to)) return null;
  if (label === null || !signature || !departure || !arrival || !options) return null;
  return { from, to, label, options, signature, departure, arrival };
}

/** Prüft die Angaben aus der App; null bei ungültigen Werten */
export function parsePushTopics(value: unknown): PushTopics | null {
  if (!isRecord(value) || typeof value.alerts !== "boolean" || typeof value.quiet !== "boolean") {
    return null;
  }
  if (!Array.isArray(value.stops) || value.stops.length > MAX_TOPIC_STOPS) return null;
  const stops = value.stops.map(parseStop);
  if (stops.some((s) => s === null)) return null;
  const trip = value.trip === null || value.trip === undefined ? null : parseTrip(value.trip);
  if (value.trip && !trip) return null;
  return {
    alerts: value.alerts,
    stops: stops.filter((s): s is PushStopTopic => s !== null),
    trip,
    quiet: value.quiet,
  };
}

/** Für die Übertragung: Optionen als Query-String (gleiches Format wie die API) */
export function serializePushTopics(topics: PushTopics): unknown {
  return {
    ...topics,
    trip: topics.trip
      ? { ...topics.trip, options: journeyOptionsToParams(topics.trip.options).toString() }
      : null,
  };
}
