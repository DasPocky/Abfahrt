import type { Departure, DeparturesResponse, Stop, StopSearchResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json, UpstreamError } from "./http";
import * as transitous from "./sources/transitous";
import * as vrr from "./sources/vrr";

const STOP_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;
const SEARCH_TTL = 24 * 60 * 60;
const DEPARTURES_TTL = 30;
const MAPPING_TTL = 7 * 24 * 60 * 60;
/** Bereits abgefahrene Fahrten bis zu dieser Zeit noch zeigen (z. B. „jetzt“) */
const PAST_TOLERANCE_MS = 60_000;

function departureTime(d: Departure): number {
  return Date.parse(d.realtimeTime ?? d.plannedTime);
}

export function sortAndTrim(departures: Departure[], from: number): Departure[] {
  return departures
    .filter((d) => departureTime(d) >= from - PAST_TOLERANCE_MS)
    .toSorted((a, b) => departureTime(a) - departureTime(b));
}

export async function searchStops(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 80) {
    return apiError(400, "invalid_query", "Suchbegriff mit 2 bis 80 Zeichen angeben");
  }
  const key = `search:${q.toLowerCase()}`;
  const stops = await cached<Stop[]>(request, ctx, key, SEARCH_TTL, async () => {
    try {
      return await vrr.searchStops(q);
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      return transitous.searchStops(q);
    }
  });
  const body: StopSearchResponse = { stops };
  return json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}

async function transitousForStop(
  request: Request,
  ctx: ExecutionContext,
  stop: Stop,
): Promise<string | null> {
  return cached(request, ctx, `map:${stop.id}`, MAPPING_TTL, () =>
    transitous.findMatchingStop(stop),
  );
}

async function loadDepartures(
  request: Request,
  ctx: ExecutionContext,
  stopId: string,
  when: Date | undefined,
): Promise<DeparturesResponse> {
  const generatedAt = new Date().toISOString();
  const [source, rawId] = [
    stopId.slice(0, stopId.indexOf(":")),
    stopId.slice(stopId.indexOf(":") + 1),
  ];

  if (source === "transitous") {
    const result = await transitous.departures(rawId, when);
    return {
      stop: { id: stopId, name: result.stopName ?? rawId },
      departures: result.departures,
      source: "transitous",
      generatedAt,
    };
  }

  // VRR-Haltestelle: im VRR-Gebiet vom VRR (für die Zukunft gibt es dort noch keine
  // Echtzeit, dann trotzdem VRR), sonst über Transitous
  const fromVrr = await vrr.departures(rawId, when);
  const isFuture = when !== undefined && when.getTime() - Date.now() > 60 * 60 * 1000;
  if (vrr.isVrrArea(rawId) && (fromVrr.hasRealtime || isFuture)) {
    return { stop: fromVrr.stop, departures: fromVrr.departures, source: "vrr", generatedAt };
  }
  const transitousId = await transitousForStop(request, ctx, fromVrr.stop);
  if (transitousId) {
    try {
      const result = await transitous.departures(transitousId, when);
      if (result.departures.length > 0) {
        return {
          stop: fromVrr.stop,
          departures: result.departures,
          source: "transitous",
          generatedAt,
        };
      }
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
    }
  }
  // Fallback: Fahrplandaten vom VRR (ohne Echtzeit)
  return { stop: fromVrr.stop, departures: fromVrr.departures, source: "vrr", generatedAt };
}

export async function getDepartures(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const stopId = params.get("stop") ?? "";
  if (!STOP_ID.test(stopId)) return apiError(400, "invalid_stop", "Ungültige Haltestellen-ID");

  const whenParam = params.get("when");
  let when: Date | undefined;
  if (whenParam) {
    when = new Date(whenParam);
    const diff = when.getTime() - Date.now();
    if (Number.isNaN(diff) || Math.abs(diff) > 7 * 24 * 60 * 60 * 1000) {
      return apiError(400, "invalid_when", "Zeitpunkt im ISO-Format, höchstens 7 Tage entfernt");
    }
  }

  // Cache-Schlüssel auf die Minute gerundet, damit Nutzer sich die Abfrage teilen
  const minute = when ? Math.floor(when.getTime() / 60_000) : "now";
  const result = await cached(request, ctx, `dep:${stopId}:${minute}`, DEPARTURES_TTL, () =>
    loadDepartures(request, ctx, stopId, when),
  );
  const body: DeparturesResponse = {
    ...result,
    departures: sortAndTrim(result.departures, when?.getTime() ?? Date.now()),
  };
  return json(body);
}
