// Zugriff auf die Worker-API (Vertrag: shared/api-types.ts)
import type {
  Alert,
  AlertsResponse,
  ApiError,
  DeparturesResponse,
  Journey,
  JourneysResponse,
  StopSearchResponse,
} from "../../shared/api-types";
import {
  DEFAULT_JOURNEY_OPTIONS,
  journeyOptionsToParams,
  type JourneyOptions,
} from "../../shared/journey-options";
import { API_PREFIX } from "../../shared/base-path";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? `API-Fehler ${status} (${code})`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function isApiError(value: unknown): value is ApiError {
  return isObject(value) && typeof value.error === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Grobe Formprüfung der Antwort, damit kaputte Daten als Fehler statt als Absturz enden */
export function isStopSearchResponse(value: unknown): value is StopSearchResponse {
  return isObject(value) && Array.isArray(value.stops);
}

export function isDeparturesResponse(value: unknown): value is DeparturesResponse {
  return (
    isObject(value) &&
    isObject(value.stop) &&
    typeof value.stop.name === "string" &&
    Array.isArray(value.departures) &&
    (value.source === "vrr" || value.source === "transitous") &&
    typeof value.generatedAt === "string"
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Grobe Prüfung einer Verbindung (Antwort der API oder gespeicherte Fahrt) */
export function isJourney(value: unknown): value is Journey {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.legs) &&
    value.legs.length > 0 &&
    value.legs.every((l) => isObject(l) && isObject(l.origin) && isObject(l.destination))
  );
}

export function isJourneysResponse(value: unknown): value is JourneysResponse {
  return (
    isObject(value) &&
    isObject(value.from) &&
    typeof value.from.name === "string" &&
    isObject(value.to) &&
    typeof value.to.name === "string" &&
    Array.isArray(value.journeys) &&
    value.journeys.every(isJourney) &&
    (value.source === "vrr" || value.source === "transitous") &&
    typeof value.generatedAt === "string" &&
    isNullableString(value.earlier) &&
    isNullableString(value.later)
  );
}

const ALERT_KINDS = new Set(["blocking", "facility", "info"]);
const ALERT_SEVERITIES = new Set(["high", "normal", "low"]);

function isAlert(value: unknown): value is Alert {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    ALERT_KINDS.has(value.kind) &&
    typeof value.severity === "string" &&
    ALERT_SEVERITIES.has(value.severity) &&
    typeof value.title === "string" &&
    typeof value.text === "string" &&
    isNullableString(value.url) &&
    isNullableString(value.validFrom) &&
    isNullableString(value.validTo) &&
    Array.isArray(value.lines) &&
    value.lines.every(
      (l) => isObject(l) && typeof l.line === "string" && typeof l.mode === "string",
    ) &&
    Array.isArray(value.stops) &&
    value.stops.every((s) => isObject(s) && typeof s.id === "string" && typeof s.name === "string")
  );
}

export function isAlertsResponse(value: unknown): value is AlertsResponse {
  return (
    isObject(value) &&
    typeof value.area === "string" &&
    isNullableString(value.areaName) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isAlert) &&
    (value.source === "vrr" || value.source === "transitous") &&
    typeof value.generatedAt === "string"
  );
}

export async function getJson<T>(
  path: string,
  guard: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    if (isApiError(body)) throw new ApiRequestError(res.status, body.error, body.message);
    throw new ApiRequestError(res.status, "http_error");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!guard(body)) throw new ApiRequestError(res.status, "invalid_response");
  return body;
}

/** Haltestellensuche; `places` liefert zusätzlich Adressen und POIs (Verbindungssuche) */
export function searchStops(
  query: string,
  signal?: AbortSignal,
  places = false,
): Promise<StopSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (places) params.set("places", "1");
  return getJson(`stops/search?${params.toString()}`, isStopSearchResponse, signal);
}

/** Auf 3 Nachkommastellen (~100 m) gerundet: genauer verlässt der Standort das Gerät nicht */
export function roundCoord(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

export function nearbyStops(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<StopSearchResponse> {
  const params = new URLSearchParams({ lat: roundCoord(lat), lon: roundCoord(lon) });
  return getJson(`stops/nearby?${params.toString()}`, isStopSearchResponse, signal);
}

export function fetchDepartures(
  stopId: string,
  signal?: AbortSignal,
  when?: string,
): Promise<DeparturesResponse> {
  const params = new URLSearchParams({ stop: stopId });
  if (when !== undefined) params.set("when", when);
  return getJson(`departures?${params.toString()}`, isDeparturesResponse, signal);
}

export interface AlertsParams {
  /** Haltestelle: Meldungen ihrer Gemeinde, die sie oder eine der `lines` betreffen */
  stop?: string;
  lines?: readonly string[];
  /** 7-stelliger Gemeindeschlüssel: alle Meldungen der Gemeinde */
  area?: string;
}

/** Störungsmeldungen; nur Haltestellen mit `vrr:`-ID haben welche */
export function fetchAlerts(
  { stop, lines = [], area }: AlertsParams,
  signal?: AbortSignal,
): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (stop !== undefined) params.set("stop", stop);
  if (lines.length > 0) params.set("lines", lines.join(","));
  if (area !== undefined) params.set("area", area);
  return getJson(`alerts?${params.toString()}`, isAlertsResponse, signal);
}

export interface JourneysParams {
  from: string;
  to: string;
  /** ISO-8601; fehlt = jetzt */
  when?: string;
  /** `when` ist die gewünschte Ankunftszeit */
  arrive?: boolean;
  options?: JourneyOptions;
}

export function fetchJourneys(
  { from, to, when, arrive = false, options = DEFAULT_JOURNEY_OPTIONS }: JourneysParams,
  signal?: AbortSignal,
): Promise<JourneysResponse> {
  const params = new URLSearchParams({ from, to });
  if (when !== undefined) params.set("when", when);
  params.set("arrive", arrive ? "1" : "0");
  journeyOptionsToParams(options, params);
  return getJson(`journeys?${params.toString()}`, isJourneysResponse, signal);
}

/** Pfad der Abfahrtsseite (relativ zum Router-basename) */
export function stopPath(stopId: string): string {
  return `/haltestelle/${encodeURIComponent(stopId)}`;
}

/** Bei Client-Fehlern (4xx) nicht wiederholen, sonst höchstens zweimal */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}
