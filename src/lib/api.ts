// Zugriff auf die Worker-API (Vertrag: shared/api-types.ts)
import type {
  ApiError,
  DeparturesResponse,
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

export function isJourneysResponse(value: unknown): value is JourneysResponse {
  return (
    isObject(value) &&
    isObject(value.from) &&
    typeof value.from.name === "string" &&
    isObject(value.to) &&
    typeof value.to.name === "string" &&
    Array.isArray(value.journeys) &&
    value.journeys.every((j) => isObject(j) && Array.isArray(j.legs) && j.legs.length > 0) &&
    (value.source === "vrr" || value.source === "transitous") &&
    typeof value.generatedAt === "string" &&
    isNullableString(value.earlier) &&
    isNullableString(value.later)
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

export function searchStops(query: string, signal?: AbortSignal): Promise<StopSearchResponse> {
  const params = new URLSearchParams({ q: query });
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
