import type { Journey, JourneysResponse, Stop } from "../shared/api-types";
import {
  journeyOptionsFromParams,
  journeyOptionsKey,
  type JourneyOptions,
} from "../shared/journey-options";
import { lineColorsForStop } from "./api";
import { cached } from "./cache";
import { apiError, json, UpstreamError } from "./http";
import { applyJourneyLineColors, type LineColorMap } from "./line-colors";
import * as transitousTrips from "./sources/transitous-trips";
import { isVrrArea } from "./sources/vrr";
import { parseGeoId } from "../shared/geo-id";
import * as vrrTrips from "./sources/vrr-trips";
import { transferEffort } from "../shared/transfers";

const STOP_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;

/** Haltestellen-ID oder Adresse/POI als geo-ID */
function isPlaceId(id: string): boolean {
  return STOP_ID.test(id) || parseGeoId(id) !== null;
}
/** Kurz, damit Echtzeit aktuell bleibt; Transitous-Limit schont der gemeinsame Cache */
const JOURNEYS_TTL = 60;
const MAX_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
/** „Früher“ springt mindestens so weit zurück */
const MIN_EARLIER_MS = 20 * 60_000;

type Loaded = Omit<JourneysResponse, "earlier" | "later" | "generatedAt">;

function inVrr(id: string): boolean {
  return id.startsWith("vrr:") && isVrrArea(id.slice("vrr:".length));
}

function isGeo(id: string): boolean {
  return id.startsWith("geo:");
}

/** Der VRR versteht eigene Haltestellen-IDs und Koordinaten */
function vrrCapable(id: string): boolean {
  return id.startsWith("vrr:") || isGeo(id);
}

/** Spricht für den VRR als erste Quelle: Haltestelle im VRR-Gebiet oder Adresse/POI */
function vrrSide(id: string): boolean {
  return inVrr(id) || isGeo(id);
}

function fallbackStop(id: string): Stop {
  const geo = parseGeoId(id);
  if (geo) return { id, name: "Gewählter Ort", ...geo };
  return { id, name: id.slice(id.indexOf(":") + 1) };
}

/** Bei Adressen/POIs liefert die Quelle eigene IDs; die App braucht ihre geo-ID zurück */
function endpoint(requested: string, returned: Stop | null): Stop {
  if (!returned) return fallbackStop(requested);
  return isGeo(requested) ? { ...returned, id: requested } : returned;
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

/** Gleiche Verbindung (Abschnitte mit Linie, Start und Zeiten) nur einmal; die Quellen liefern
 * gelegentlich Doppelte */
export function dedupeJourneys(journeys: readonly Journey[]): Journey[] {
  const seen = new Set<string>();
  return journeys.filter((j) => {
    const key = j.legs
      .map(
        (l) =>
          `${l.line ?? "walk"}@${l.origin.plannedDeparture ?? ""}>${l.destination.plannedArrival ?? ""}`,
      )
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/** So viel später darf eine bequemere Variante ankommen, um vorne zu stehen */
export const SAME_PLATFORM_EXTRA_MS = 5 * 60_000;

function arrivalOf(j: Journey): number {
  const d = j.legs.at(-1)?.destination;
  return Date.parse(d?.plannedArrival ?? d?.plannedDeparture ?? "");
}

/** Erste Fahrt (Linie und Abfahrt), daran erkennt man Varianten derselben Abfahrt */
function firstRide(j: Journey): string {
  const leg = j.legs.find((l) => l.kind === "transit");
  return `${leg?.line ?? ""}@${leg?.origin.plannedDeparture ?? ""}`;
}

/**
 * Sortiert nach Abfahrt, dann Ankunft. Varianten derselben ersten Fahrt: Hat eine weniger
 * Umstiegsaufwand (Steigwechsel, Fußwege; `transferEffort`) und kommt höchstens
 * SAME_PLATFORM_EXTRA_MS später an, steht sie vorn (#97, z. B. U83 → U72 am selben Steig an
 * Schlüterstraße statt U83 → U76 mit Steigwechsel an Heinrich-Heine-Allee). Gilt für alle
 * Verbindungen, nicht für bestimmte Linien.
 */
export function orderJourneys(journeys: readonly Journey[]): Journey[] {
  const sorted = journeys.toSorted(
    (a, b) => departureOf(a) - departureOf(b) || arrivalOf(a) - arrivalOf(b),
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    const fast = sorted[i]!;
    let best: { index: number; effort: number } | null = null;
    for (let k = i + 1; k < sorted.length; k++) {
      const other = sorted[k]!;
      if (firstRide(other) !== firstRide(fast)) break;
      const effort = transferEffort(other);
      if (
        effort < (best?.effort ?? transferEffort(fast)) &&
        arrivalOf(other) - arrivalOf(fast) <= SAME_PLATFORM_EXTRA_MS
      ) {
        best = { index: k, effort };
      }
    }
    if (best) {
      const [comfy] = sorted.splice(best.index, 1);
      sorted.splice(i, 0, comfy!);
    }
  }
  return sorted;
}

/** Höchstens so viele Haltestellen je Antwort nach Linienfarben fragen */
const MAX_COLOR_STOPS = 6;

/**
 * Linienfarben für VRR-Verbindungen (die EFA liefert keine): je Einstiegshaltestelle die Farben
 * aus Transitous, 7 Tage gecacht und wie bei den Abfahrten höchstens 2,5 s abgewartet.
 */
export async function withLineColors(
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

/** Verbindungen ohne Cache und ohne Linienfarben (auch für die Push-Prüfung, worker/push/cron.ts) */
export async function loadJourneys(
  from: string,
  to: string,
  when: Date | undefined,
  arrive: boolean,
  options: JourneyOptions,
  /**
   * Beim VRR zusätzlich mit „wenig Fußweg“ (LEASTWALKING) fragen: So liefert er Varianten mit
   * Umstieg am selben Steig und kurzen Wegen (#97). Kostet eine zweite, parallele Abfrage; die
   * Push-Prüfung braucht es nicht.
   */
  samePlatformVariants = false,
): Promise<Loaded> {
  const viaTransitous = async (): Promise<Loaded> => {
    const r = await transitousTrips.trips(from, to, when, arrive, options);
    return {
      from: endpoint(from, r.from),
      to: endpoint(to, r.to),
      journeys: r.journeys,
      source: "transitous",
    };
  };
  const viaVrr = async (): Promise<Loaded> => {
    const [r, comfy] = await Promise.all([
      vrrTrips.trips(from, to, when, arrive, options),
      // nur bei „schnellste“: eine eigene Routenwahl gilt so, wie gewählt
      samePlatformVariants && options.route === "fastest"
        ? vrrTrips.trips(from, to, when, arrive, options, "lessWalking").catch((err: unknown) => {
            if (err instanceof UpstreamError) return null;
            throw err;
          })
        : null,
    ]);
    return {
      from: endpoint(from, r.from),
      to: endpoint(to, r.to),
      journeys: comfy
        ? orderJourneys(dedupeJourneys([...r.journeys, ...comfy.journeys]))
        : r.journeys,
      source: "vrr",
    };
  };

  // Im VRR (beide Enden) mit VRR-Echtzeit, sonst Transitous; die jeweils andere Quelle ist Fallback.
  // Der VRR kennt nur eigene IDs (DHID) und Koordinaten; mit Transitous-IDs bleibt Transitous
  // allein zuständig. VRR zuerst, wenn beide Enden im VRR-Gebiet liegen oder Adressen/POIs sind.
  // Ein Zwischenhalt aus Transitous lässt sich dem VRR nicht übergeben
  const vrrPossible =
    vrrCapable(from) && vrrCapable(to) && (options.via === null || options.via.startsWith("vrr:"));
  const primary = vrrPossible && vrrSide(from) && vrrSide(to) ? viaVrr : viaTransitous;
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
  if (!isPlaceId(from) || !isPlaceId(to)) {
    return apiError(400, "invalid_stop", "Ungültige Haltestellen-ID für Start oder Ziel");
  }
  if (from === to) return apiError(400, "same_stop", "Start und Ziel sind gleich");

  const arrive = params.get("arrive") === "1";
  const options = journeyOptionsFromParams(params);
  if (!options) {
    return apiError(400, "invalid_options", "Ungültige Optionen für die Verbindungssuche");
  }
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
  const key = `jrn:v3:${from}>${to}:${arrive ? "arr" : "dep"}:${minute}:${journeyOptionsKey(options)}`;
  const loaded = await cached(request, ctx, key, JOURNEYS_TTL, async () => {
    const result = await loadJourneys(from, to, at, arrive, options, true);
    return result.source === "vrr"
      ? { ...result, journeys: await withLineColors(request, ctx, result.journeys) }
      : result;
  });
  const unique = dedupeJourneys(loaded.journeys);
  const journeys = arrive ? unique : dropDeparted(unique, at.getTime());
  const body: JourneysResponse = {
    ...loaded,
    journeys,
    generatedAt: new Date().toISOString(),
    ...paging(journeys),
  };
  return json(body);
}
