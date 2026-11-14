import type { Journey, JourneyLeg, JourneyStop, Stop } from "../../shared/api-types";
import { fetchJson } from "../http";
import { stripCityPrefix } from "./transitous-map";
import { efaDateTime, MODE_BY_CLASS } from "./vrr";

// VRR OpenService, Verbindungen (XML_TRIP_REQUEST2), siehe docs/01-datenquellen.md
const BASE = "https://openservice.vrr.de/openservice";
const COMMON = "outputFormat=rapidJSON&version=10.4.18.18&coordOutputFormat=WGS84%5Bdd.ddddd%5D";
/** EFA-Produktklassen für Fußwege */
const WALK_CLASSES = new Set([97, 98, 99, 100]);

interface VrrPoint {
  id?: string;
  name?: string;
  disassembledName?: string;
  type?: string;
  coord?: [number, number];
  parent?: VrrPoint;
  arrivalTimePlanned?: string;
  arrivalTimeEstimated?: string;
  departureTimePlanned?: string;
  departureTimeEstimated?: string;
  properties?: { platform?: string; platformName?: string; plannedPlatformName?: string };
}

interface VrrLeg {
  duration?: number;
  distance?: number;
  isRealtimeControlled?: boolean;
  realtimeStatus?: string[];
  origin: VrrPoint;
  destination: VrrPoint;
  transportation?: {
    name?: string;
    disassembledName?: string;
    number?: string;
    product?: { class?: number };
    destination?: { name?: string };
    properties?: { trainType?: string; trainNumber?: string; lineDisplay?: string };
  };
  stopSequence?: VrrPoint[];
  infos?: { title?: string; subtitle?: string }[];
}

interface VrrJourney {
  interchanges?: number;
  legs?: VrrLeg[];
}

export interface VrrTripResult {
  journeys: Journey[];
  from: Stop | null;
  to: Stop | null;
}

/** Haltestelle (nicht Steig) eines Punkts */
function stopOf(point: VrrPoint): VrrPoint {
  return point.type !== "stop" && point.parent?.type === "stop" ? point.parent : point;
}

function placeOf(point: VrrPoint): string | undefined {
  const stop = stopOf(point);
  return stop.parent?.type === "locality" ? stop.parent.name : undefined;
}

function toStop(point: VrrPoint): Stop {
  const stop = stopOf(point);
  return {
    id: `vrr:${stop.id ?? ""}`,
    name: stripCityPrefix(stop.name ?? ""),
    place: placeOf(point),
    lat: stop.coord?.[0],
    lon: stop.coord?.[1],
  };
}

function toJourneyStop(point: VrrPoint, realtime: boolean): JourneyStop {
  const stop = stopOf(point);
  const props = point.properties ?? {};
  const platform = props.platformName ?? props.platform ?? null;
  const plannedPlatform = props.plannedPlatformName ?? null;
  return {
    id: stop.id?.startsWith("de:") ? `vrr:${stop.id}` : null,
    name: stripCityPrefix(stop.name ?? ""),
    place: placeOf(point),
    lat: point.coord?.[0] ?? stop.coord?.[0],
    lon: point.coord?.[1] ?? stop.coord?.[1],
    plannedArrival: point.arrivalTimePlanned ?? null,
    realtimeArrival: realtime ? (point.arrivalTimeEstimated ?? null) : null,
    plannedDeparture: point.departureTimePlanned ?? null,
    realtimeDeparture: realtime ? (point.departureTimeEstimated ?? null) : null,
    platform: platform || null,
    plannedPlatform: plannedPlatform && plannedPlatform !== platform ? plannedPlatform : null,
    cancelled: false,
  };
}

/** Linienname: bei Zügen „ICE 620“, sonst die Kurzbezeichnung („U75“, „S6“, „RE1“) */
export function lineName(t: NonNullable<VrrLeg["transportation"]>): string {
  const { trainType, trainNumber } = t.properties ?? {};
  if (!t.disassembledName && trainType && trainNumber) return `${trainType} ${trainNumber}`;
  return t.disassembledName ?? t.number ?? t.name ?? "?";
}

function minutes(seconds: number | undefined): number {
  return Math.max(0, Math.round((seconds ?? 0) / 60));
}

export function toLeg(leg: VrrLeg): JourneyLeg {
  const t = leg.transportation ?? {};
  const cls = t.product?.class ?? -1;
  const walk = WALK_CLASSES.has(cls);
  const realtime = leg.isRealtimeControlled === true;
  const cancelled = (leg.realtimeStatus ?? []).some((s) => s.includes("CANCEL"));
  const sequence = leg.stopSequence ?? [];
  const notices = [
    ...new Set((leg.infos ?? []).map((i) => (i.subtitle ?? i.title ?? "").trim()).filter(Boolean)),
  ].slice(0, 3);
  return {
    kind: walk ? "walk" : "transit",
    origin: toJourneyStop(leg.origin, realtime),
    destination: toJourneyStop(leg.destination, realtime),
    durationMinutes: minutes(leg.duration),
    distanceMeters: walk ? (leg.distance ?? null) : null,
    line: walk ? null : lineName(t),
    mode: walk ? null : (MODE_BY_CLASS[cls] ?? "other"),
    direction: walk ? null : stripCityPrefix(t.destination?.name ?? "") || null,
    lineColor: null,
    lineTextColor: null,
    intermediateStops: walk ? [] : sequence.slice(1, -1).map((p) => toJourneyStop(p, realtime)),
    cancelled,
    notices: walk ? [] : notices,
  };
}

function legStart(leg: JourneyLeg): string {
  return leg.origin.plannedDeparture ?? leg.origin.plannedArrival ?? "";
}

function legEnd(leg: JourneyLeg): string {
  return leg.destination.plannedArrival ?? leg.destination.plannedDeparture ?? "";
}

export function toJourney(journey: VrrJourney, index: number): Journey | null {
  const legs = (journey.legs ?? []).map(toLeg);
  const first = legs[0];
  const last = legs.at(-1);
  if (!first || !last) return null;
  const transit = legs.filter((l) => l.kind === "transit").length;
  const start = Date.parse(legStart(first));
  const end = Date.parse(legEnd(last));
  return {
    id: `${index}-${legStart(first)}-${legs.map((l) => l.line ?? "walk").join(",")}`,
    legs,
    transfers: Math.max(0, transit - 1),
    durationMinutes: Number.isNaN(end - start) ? 0 : Math.round((end - start) / 60_000),
  };
}

/** EFA meldet unbekannte Start-/Zielpunkte nur als Systemmeldung (z. B. „origin: multiple matches“) */
function isUnknownPoint(messages: { type?: string; text?: string }[]): boolean {
  return messages.some((m) => m.type === "error" && /^(origin|destination)\b/.test(m.text ?? ""));
}

export async function trips(
  fromId: string,
  toId: string,
  when: Date | undefined,
  arrive: boolean,
): Promise<VrrTripResult> {
  let url =
    `${BASE}/XML_TRIP_REQUEST2?${COMMON}&useRealtime=1&calcNumberOfTrips=5` +
    `&type_origin=any&name_origin=${encodeURIComponent(fromId)}` +
    `&type_destination=any&name_destination=${encodeURIComponent(toId)}`;
  if (when) {
    const { date, time } = efaDateTime(when);
    url += `&itdDate=${date}&itdTime=${time}&itdTripDateTimeDepArr=${arrive ? "arr" : "dep"}`;
  }
  const data = await fetchJson<{
    journeys?: VrrJourney[];
    systemMessages?: { type?: string; text?: string }[];
  }>("vrr", url);
  const raw = data.journeys ?? [];
  if (raw.length === 0 && isUnknownPoint(data.systemMessages ?? [])) {
    throw new Error("not_found");
  }
  const firstLegs = raw[0]?.legs ?? [];
  const firstLeg = firstLegs[0];
  const lastLeg = firstLegs.at(-1);
  return {
    journeys: raw.map(toJourney).filter((j): j is Journey => j !== null),
    from: firstLeg ? toStop(firstLeg.origin) : null,
    to: lastLeg ? toStop(lastLeg.destination) : null,
  };
}
