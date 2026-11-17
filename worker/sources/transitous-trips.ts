import type { Journey, JourneyLeg, JourneyStop, Stop } from "../../shared/api-types";
import { parseGeoId } from "../../shared/geo-id";
import { DEFAULT_JOURNEY_OPTIONS, type JourneyOptions } from "../../shared/journey-options";
import { decodePolyline, legPath } from "../geometry";
import { fetchJson } from "../http";
import { normalizeHex } from "../line-colors";
import { MODE_MAP } from "./transitous";
import { stripCityPrefix } from "../stop-names";
import { dhidOf } from "./transitous-map";
import { isVrrArea } from "./vrr";

// Transitous (MOTIS 2) `v5/plan`. Limit: unter 720 Abfragen pro Tag, daher nur außerhalb des
// VRR bzw. als Fallback und immer gecacht (siehe docs/01-datenquellen.md).
const BASE = "https://api.transitous.org/api";

interface PlanPlace {
  name: string;
  stopId?: string;
  parentId?: string;
  lat: number;
  lon: number;
  arrival?: string;
  departure?: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  track?: string;
  scheduledTrack?: string;
  cancelled?: boolean;
}

interface PlanLeg {
  mode: string;
  from: PlanPlace;
  to: PlanPlace;
  duration?: number;
  distance?: number;
  realTime?: boolean;
  headsign?: string;
  displayName?: string;
  routeShortName?: string;
  routeColor?: string;
  routeTextColor?: string;
  cancelled?: boolean;
  intermediateStops?: PlanPlace[];
  /** Streckenverlauf als Encoded Polyline; `precision` meist 6 (getestet 15.11.2026) */
  legGeometry?: { points?: string; precision?: number; length?: number };
}

interface PlanItinerary {
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: PlanLeg[];
}

export interface TransitousTripResult {
  journeys: Journey[];
  from: Stop | null;
  to: Stop | null;
}

/** App-ID einer Transitous-Haltestelle: im VRR-Gebiet die VRR-ID (sekundengenaue Echtzeit) */
export function appStopId(place: PlanPlace): string | null {
  const id = place.parentId ?? place.stopId;
  if (!id) return null;
  const dhid = dhidOf(id);
  return dhid && isVrrArea(dhid) ? `vrr:${dhid}` : `transitous:${id}`;
}

function toStop(place: PlanPlace): Stop {
  return {
    id: appStopId(place) ?? "",
    name: stripCityPrefix(place.name),
    lat: place.lat,
    lon: place.lon,
  };
}

function toJourneyStop(place: PlanPlace, realtime: boolean): JourneyStop {
  const platform = place.track ?? null;
  const plannedPlatform = place.scheduledTrack ?? null;
  return {
    id: appStopId(place),
    name: stripCityPrefix(place.name),
    lat: place.lat,
    lon: place.lon,
    plannedArrival: place.scheduledArrival ?? null,
    realtimeArrival: realtime ? (place.arrival ?? null) : null,
    plannedDeparture: place.scheduledDeparture ?? null,
    realtimeDeparture: realtime ? (place.departure ?? null) : null,
    platform,
    plannedPlatform: plannedPlatform !== platform ? plannedPlatform : null,
    cancelled: place.cancelled === true,
  };
}

export function toLeg(leg: PlanLeg): JourneyLeg {
  const walk = leg.mode === "WALK" || leg.mode === "BIKE" || leg.mode === "CAR";
  const realtime = leg.realTime === true;
  const origin = toJourneyStop(leg.from, realtime);
  const destination = toJourneyStop(leg.to, realtime);
  if (walk) {
    // Fußwege haben keinen eigenen Fahrplan: Ankunft am Start bzw. Abfahrt am Ziel entfallen
    origin.plannedArrival = origin.realtimeArrival = null;
    destination.plannedDeparture = destination.realtimeDeparture = null;
  }
  const intermediateStops = walk
    ? []
    : (leg.intermediateStops ?? []).map((p) => toJourneyStop(p, realtime));
  const geometry = leg.legGeometry?.points
    ? decodePolyline(leg.legGeometry.points, leg.legGeometry.precision ?? 6)
    : null;
  return {
    kind: walk ? "walk" : "transit",
    origin,
    destination,
    durationMinutes: Math.max(0, Math.round((leg.duration ?? 0) / 60)),
    distanceMeters: walk && leg.distance !== undefined ? Math.round(leg.distance) : null,
    line: walk ? null : (leg.displayName ?? leg.routeShortName ?? "?"),
    mode: walk ? null : (MODE_MAP[leg.mode] ?? "other"),
    direction: walk ? null : leg.headsign ? stripCityPrefix(leg.headsign) : null,
    lineColor: walk ? null : normalizeHex(leg.routeColor),
    lineTextColor: walk ? null : normalizeHex(leg.routeTextColor),
    intermediateStops,
    cancelled: leg.cancelled === true,
    notices: [],
    path: legPath(geometry, [origin, ...intermediateStops, destination]),
  };
}

export function toJourney(it: PlanItinerary, index: number): Journey | null {
  const legs = (it.legs ?? []).map(toLeg);
  if (legs.length === 0) return null;
  const transit = legs.filter((l) => l.kind === "transit").length;
  const first = legs[0];
  const start = first?.origin.plannedDeparture ?? it.startTime ?? "";
  return {
    id: `${index}-${start}-${legs.map((l) => l.line ?? "walk").join(",")}`,
    legs,
    transfers: Math.max(0, transit - 1),
    durationMinutes: Math.round((it.duration ?? 0) / 60),
  };
}

/** Mindest-Umstiegszeit in Minuten je Umstiegstempo (MOTIS `minTransferTime`) */
const MIN_TRANSFER_MINUTES = { fast: 0, normal: 0, slow: 5 } as const;

/** Optionen als MOTIS-Parameter */
export function optionParams(options: JourneyOptions): string {
  let params = "";
  if (options.exclude.length > 0) {
    // Erlaubte Verkehrsmittel aufzählen: alle bekannten MOTIS-Modi außer den ausgeschlossenen
    const allowed = Object.entries(MODE_MAP)
      // RAIL steht in MOTIS für alle Bahnen, die genauen Modi reichen
      .filter(([motis, mode]) => motis !== "RAIL" && !options.exclude.includes(mode))
      .map(([motis]) => motis);
    params += `&transitModes=${allowed.join(",")}`;
  }
  if (options.maxTransfers !== null) params += `&maxTransfers=${options.maxTransfers}`;
  const minTransfer = MIN_TRANSFER_MINUTES[options.transferSpeed];
  if (minTransfer > 0) params += `&minTransferTime=${minTransfer}`;
  if (options.accessible) params += "&pedestrianProfile=WHEELCHAIR";
  return params;
}

/** Transitous-ID zu einer App-ID: VRR-IDs (DHID) gibt es im DELFI-Datensatz */
export function planPlaceId(appId: string): string {
  const geo = parseGeoId(appId);
  if (geo) return `${geo.lat},${geo.lon}`;
  if (appId.startsWith("transitous:")) return appId.slice("transitous:".length);
  return `de-DELFI_${appId.slice(appId.indexOf(":") + 1)}`;
}

export async function trips(
  fromId: string,
  toId: string,
  when: Date | undefined,
  arrive: boolean,
  options: JourneyOptions = DEFAULT_JOURNEY_OPTIONS,
): Promise<TransitousTripResult> {
  let url =
    `${BASE}/v5/plan?numItineraries=5&detailedTransfers=false&language=de` +
    `&fromPlace=${encodeURIComponent(planPlaceId(fromId))}` +
    `&toPlace=${encodeURIComponent(planPlaceId(toId))}` +
    optionParams(options);
  if (when) url += `&time=${encodeURIComponent(when.toISOString())}&arriveBy=${arrive}`;
  const data = await fetchJson<{ from?: PlanPlace; to?: PlanPlace; itineraries?: PlanItinerary[] }>(
    "transitous",
    url,
  );
  return {
    journeys: (data.itineraries ?? []).map(toJourney).filter((j): j is Journey => j !== null),
    from: data.from ? toStop(data.from) : null,
    to: data.to ? toStop(data.to) : null,
  };
}
