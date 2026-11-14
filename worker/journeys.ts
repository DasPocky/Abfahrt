import type { Journey, JourneysResponse, Stop } from "../shared/api-types";
import { lineColorsForStop } from "./api";
import { cached } from "./cache";
import { apiError, json, UpstreamError } from "./http";
import { applyJourneyLineColors, type LineColorMap } from "./line-colors";
import * as transitousTrips from "./sources/transitous-trips";
import { isVrrArea } from "./sources/vrr";
import * as vrrTrips from "./sources/vrr-trips";

const STOP_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;
/** Kurz, damit Echtzeit aktuell bleibt; Transitous-Limit schont der gemeinsame Cache */
const JOURNEYS_TTL = 60;
const MAX_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
/** „Früher“ springt mindestens so weit zurück */
const MIN_EARLIER_MS = 20 * 60_000;

type Loaded = Omit<JourneysResponse, "earlier" | "later" | "generatedAt">;

function inVrr(id: string): boolean {
  return id.startsWith("vrr:") && isVrrArea(id.slice("vrr:".length));
}

function fallbackStop(id: string): Stop {
  return { id, name: id.slice(id.indexOf(":") + 1) };
}

function departureOf(j: Journey): number {
  const o = j.legs[0]?.origin;
  return Date.parse(o?.plannedDeparture ?? o?.plannedArrival ?? "");
}

/** Tatsächliche Abfahrt am Start (Echtzeit, sonst Plan) */
function actualDepartureOf(j: Journey): number {
  const o = j.legs[0]?.origin;
  return Date.parse(o?.realtimeDeparture ?? o?.plannedDeparture ?? o?.plannedArrival ?? "");
}

/**
 * Bereits abgefahrene Verbindungen weglassen (die EFA liefert oft eine vor dem Suchzeitpunkt mit).
 * Gilt nur für die Suche nach Abfahrtszeit.
 */
export function dropDeparted(journeys: readonly Journey[], from: number): Journey[] {
  return journeys.filter((j) => !(actualDepartureOf(j) < from - 60_000));
}

/**
 * Zeitpunkte für „Früher“/„Später“ (immer als Abfahrtszeit): später = 1 Minute nach der letzten
 * Abfahrt, früher = so weit vor der ersten Abfahrt, wie die Liste lang ist (mind. 20 Minuten).
 */
export function paging(journeys: readonly Journey[]): {
  earlier: string | null;
  later: string | null;
} {
  const times = journeys.map(departureOf).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return { earlier: null, later: null };
  const first = Math.min(...times);
  const last = Math.max(...times);
  return {
    earlier: new Date(first - Math.max(MIN_EARLIER_MS, last - first)).toISOString(),
    later: new Date(last + 60_000).toISOString(),
  };
}

/** Höchstens so viele Haltestellen je Antwort nach Linienfarben fragen */
const MAX_COLOR_STOPS = 6;

/**
 * Linienfarben für VRR-Verbindungen (die EFA liefert keine): je Einstiegshaltestelle die Farben
 * aus Transitous, 7 Tage gecacht und wie bei den Abfahrten höchstens 2,5 s abgewartet.
 */
async function withLineColors(
  request: Request,
  ctx: ExecutionContext,
  journeys: Journey[],
): Promise<Journey[]> {
  const stops = new Map<string, Stop>();
  for (const leg of journeys.flatMap((j) => j.legs)) {
    const o = leg.origin;
    if (leg.kind !== "transit" || leg.lineColor !== null || !o.id?.startsWith("vrr:")) continue;
    if (!stops.has(o.id)) stops.set(o.id, { id: o.id, name: o.name, lat: o.lat, lon: o.lon });
  }
  const maps = await Promise.all(
    [...stops.values()].slice(0, MAX_COLOR_STOPS).map((s) => lineColorsForStop(request, ctx, s)),
  );
  const colors: LineColorMap = Object.assign({}, ...maps.toReversed());
  return applyJourneyLineColors(journeys, colors);
}

async function load(
  from: string,
  to: string,
  when: Date | undefined,
  arrive: boolean,
): Promise<Loaded> {
  const viaTransitous = async (): Promise<Loaded> => {
    const r = await transitousTrips.trips(from, to, when, arrive);
    return {
      from: r.from ?? fallbackStop(from),
      to: r.to ?? fallbackStop(to),
      journeys: r.journeys,
      source: "transitous",
    };
  };
  const viaVrr = async (): Promise<Loaded> => {
    const r = await vrrTrips.trips(from, to, when, arrive);
    return {
      from: r.from ?? fallbackStop(from),
      to: r.to ?? fallbackStop(to),
      journeys: r.journeys,
      source: "vrr",
    };
  };

  // Im VRR (beide Enden) mit VRR-Echtzeit, sonst Transitous; die jeweils andere Quelle ist Fallback
  // Der VRR kennt nur eigene IDs (DHID); mit Transitous-IDs bleibt Transitous allein zuständig
  const vrrPossible = from.startsWith("vrr:") && to.startsWith("vrr:");
  const primary = inVrr(from) && inVrr(to) ? viaVrr : viaTransitous;
  const secondary = primary === viaVrr ? viaTransitous : vrrPossible ? viaVrr : null;
  if (!secondary) return primary();
  try {
    const result = await primary();
    if (result.journeys.length > 0) return result;
    try {
      const other = await secondary();
      return other.journeys.length > 0 ? other : result;
    } catch (err) {
      if (err instanceof UpstreamError) return result;
      throw err;
    }
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err;
    return secondary();
  }
}

export async function getJourneys(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!STOP_ID.test(from) || !STOP_ID.test(to)) {
    return apiError(400, "invalid_stop", "Ungültige Haltestellen-ID für Start oder Ziel");
  }
  if (from === to) return apiError(400, "same_stop", "Start und Ziel sind gleich");

  const arrive = params.get("arrive") === "1";
  const whenParam = params.get("when");
  let when: Date | undefined;
  if (whenParam) {
    when = new Date(whenParam);
    const diff = when.getTime() - Date.now();
    if (Number.isNaN(diff) || Math.abs(diff) > MAX_OFFSET_MS) {
      return apiError(400, "invalid_when", "Zeitpunkt im ISO-Format, höchstens 7 Tage entfernt");
    }
  }
  // Immer mit festem Zeitpunkt abfragen, passend zum Cache-Schlüssel und zum Filter unten
  const at = when ?? new Date();

  // Minutengenauer Schlüssel: alle, die dieselbe Strecke zur selben Minute suchen, teilen sich
  // eine Abfrage (wichtig für das Transitous-Limit)
  const minute = Math.floor(at.getTime() / 60_000);
  const key = `jrn:v1:${from}>${to}:${arrive ? "arr" : "dep"}:${minute}`;
  const loaded = await cached(request, ctx, key, JOURNEYS_TTL, async () => {
    const result = await load(from, to, at, arrive);
    return result.source === "vrr"
      ? { ...result, journeys: await withLineColors(request, ctx, result.journeys) }
      : result;
  });
  const journeys = arrive ? loaded.journeys : dropDeparted(loaded.journeys, at.getTime());
  const body: JourneysResponse = {
    ...loaded,
    journeys,
    generatedAt: new Date().toISOString(),
    ...paging(journeys),
  };
  return json(body);
}
