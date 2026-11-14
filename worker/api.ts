import type { Departure, DeparturesResponse, Stop, StopSearchResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json, UpstreamError } from "./http";
import { applyLineColors, type LineColorMap } from "./line-colors";
import * as transitous from "./sources/transitous";
import * as vrr from "./sources/vrr";

const STOP_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;
const SEARCH_TTL = 24 * 60 * 60;
const DEPARTURES_TTL = 30;
const MAPPING_TTL = 7 * 24 * 60 * 60;
const LINE_COLORS_TTL = 7 * 24 * 60 * 60;
/** So lange warten VRR-Abfahrten höchstens auf die Linienfarben */
const LINE_COLORS_WAIT_MS = 2500;
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

/** Umkreis für „In der Nähe“ in Metern */
const NEARBY_RADIUS_M = 1000;
const NEARBY_TTL = 24 * 60 * 60;

/** Koordinate auf 3 Nachkommastellen (~100 m), Bereich grob Deutschland + Grenzgebiet */
function parseCoord(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^-?\d{1,3}(\.\d+)?$/.test(value)) return null;
  const n = Math.round(Number(value) * 1000) / 1000;
  return n >= min && n <= max ? n : null;
}

/**
 * Haltestellen in der Nähe. Die App schickt die Koordinate, der Worker rundet sie auf ~100 m,
 * bevor sie Cache-Schlüssel und Datenquelle erreicht. Entfernung und Sortierung rechnet die
 * App mit der genauen Position selbst.
 */
export async function nearbyStops(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const lat = parseCoord(params.get("lat"), 47, 55.5);
  const lon = parseCoord(params.get("lon"), 5.5, 15.5);
  if (lat === null || lon === null) {
    return apiError(400, "invalid_position", "Position innerhalb Deutschlands angeben");
  }
  const key = `near:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const stops = await cached<Stop[]>(request, ctx, key, NEARBY_TTL, async () => {
    try {
      return await vrr.nearbyStops(lat, lon, NEARBY_RADIUS_M);
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      return transitous.nearbyStops(lat, lon, NEARBY_RADIUS_M);
    }
  });
  const body: StopSearchResponse = { stops };
  return json(body, { headers: { "Cache-Control": "private, max-age=300" } });
}

async function transitousForStop(
  request: Request,
  ctx: ExecutionContext,
  stop: Stop,
): Promise<string | null> {
  return cached(request, ctx, `map:v2:${stop.id}`, MAPPING_TTL, () =>
    transitous.findMatchingStop(stop),
  );
}

/**
 * Linienfarben einer VRR-Haltestelle aus Transitous, 7 Tage gecacht (eine Transitous-Abfrage
 * pro Haltestelle und Woche). Die Abfahrten warten höchstens LINE_COLORS_WAIT_MS darauf, die
 * Abfrage läuft notfalls im Hintergrund weiter und füllt den Cache für den nächsten Abruf.
 * Fällt Transitous aus, bleibt es ohne Farben und ohne Cache-Eintrag.
 */
async function lineColorsForStop(
  request: Request,
  ctx: ExecutionContext,
  stop: Stop,
): Promise<LineColorMap> {
  const lookup = cached(request, ctx, `colors:v2:${stop.id}`, LINE_COLORS_TTL, async () => {
    const transitousId = await transitousForStop(request, ctx, stop);
    return transitousId ? transitous.lineColors(transitousId) : {};
  }).catch((err: unknown): LineColorMap => {
    if (!(err instanceof UpstreamError)) console.error("Linienfarben", err);
    return {};
  });
  ctx.waitUntil(lookup);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<LineColorMap>((resolve) => {
    timer = setTimeout(() => resolve({}), LINE_COLORS_WAIT_MS);
  });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
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
  const vrrResult = async (): Promise<DeparturesResponse> => ({
    stop: fromVrr.stop,
    departures: applyLineColors(
      fromVrr.departures,
      await lineColorsForStop(request, ctx, fromVrr.stop),
    ),
    source: "vrr",
    generatedAt,
  });
  if (vrr.isVrrArea(rawId) && (fromVrr.hasRealtime || isFuture)) return vrrResult();
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
  return vrrResult();
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
