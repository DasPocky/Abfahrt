import type { Departure, Stop, TransportMode } from "../../shared/api-types";
import { fetchJson } from "../http";

// VRR OpenService (EFA rapidJSON), siehe docs/01-datenquellen.md
const BASE = "https://openservice.vrr.de/openservice";
const COMMON = "outputFormat=rapidJSON&version=10.4.18.18&coordOutputFormat=WGS84%5Bdd.ddddd%5D";

/**
 * Kreise/kreisfreie Städte im VRR (amtlicher Gemeindeschlüssel, 2. Teil der Haltestellen-ID
 * "de:05111:…"). Nur hier liefert der VRR Echtzeit; außerhalb nutzen wir Transitous.
 */
const VRR_DISTRICTS = new Set([
  "05111",
  "05112",
  "05113",
  "05114",
  "05116",
  "05117",
  "05119",
  "05120",
  "05122",
  "05124",
  "05154",
  "05158",
  "05162",
  "05166",
  "05170",
  "05512",
  "05513",
  "05562",
  "05911",
  "05913",
  "05914",
  "05916",
  "05954",
]);

export function isVrrArea(globalId: string): boolean {
  const district = globalId.split(":")[1];
  return district !== undefined && VRR_DISTRICTS.has(district);
}

// EFA-Produktklassen
const MODE_BY_CLASS: Record<number, TransportMode> = {
  0: "regional",
  1: "suburban",
  2: "subway",
  3: "subway",
  4: "tram",
  5: "bus",
  6: "bus",
  7: "bus",
  9: "ferry",
  10: "bus",
  13: "regional",
  14: "longdistance",
  15: "longdistance",
  16: "longdistance",
  17: "bus",
  19: "bus",
};

interface VrrLocation {
  id: string;
  isGlobalId?: boolean;
  name?: string;
  disassembledName?: string;
  type?: string;
  coord?: [number, number];
  parent?: { name?: string };
  matchQuality?: number;
}

interface VrrStopEvent {
  isRealtimeControlled?: boolean;
  realtimeStatus?: string[];
  departureTimePlanned?: string;
  departureTimeEstimated?: string;
  location?: {
    properties?: { platform?: string; platformName?: string; plannedPlatformName?: string };
  };
  transportation?: {
    number?: string;
    disassembledName?: string;
    product?: { class?: number };
    destination?: { name?: string };
  };
  infos?: { title?: string; subtitle?: string }[];
}

function toStop(loc: VrrLocation): Stop {
  const stop: Stop = {
    id: `vrr:${loc.id}`,
    name: loc.disassembledName ?? loc.name ?? loc.id,
    place: loc.parent?.name,
    lat: loc.coord?.[0],
    lon: loc.coord?.[1],
  };
  if (loc.matchQuality !== undefined) stop.relevance = loc.matchQuality;
  return stop;
}

export async function searchStops(query: string): Promise<Stop[]> {
  const url = `${BASE}/XML_STOPFINDER_REQUEST?${COMMON}&type_sf=any&anyObjFilter_sf=2&anyMaxSizeHitList=40&name_sf=${encodeURIComponent(query)}`;
  const data = await fetchJson<{ locations?: VrrLocation[] }>("vrr", url);
  return (data.locations ?? [])
    .filter((l) => l.type === "stop" && l.isGlobalId !== false && l.id.startsWith("de:"))
    .toSorted((a, b) => (b.matchQuality ?? 0) - (a.matchQuality ?? 0))
    .map(toStop);
}

/** Datum/Uhrzeit für die EFA in Europe/Berlin. */
function efaDateTime(when: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(when)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}${parts.month}${parts.day}`, time: `${parts.hour}${parts.minute}` };
}

export function toDeparture(event: VrrStopEvent, index: number): Departure | null {
  const planned = event.departureTimePlanned;
  const t = event.transportation;
  if (!planned || !t) return null;
  const props = event.location?.properties ?? {};
  const platform = props.platformName ?? props.platform ?? null;
  const plannedPlatform = props.plannedPlatformName ?? null;
  const line = t.disassembledName ?? t.number ?? "?";
  const notices = [
    ...new Set(
      (event.infos ?? []).map((i) => (i.subtitle ?? i.title ?? "").trim()).filter(Boolean),
    ),
  ].slice(0, 3);
  return {
    id: `${index}-${line}-${planned}`,
    line,
    mode: MODE_BY_CLASS[t.product?.class ?? -1] ?? "other",
    direction: t.destination?.name ?? "",
    plannedTime: planned,
    realtimeTime: event.isRealtimeControlled ? (event.departureTimeEstimated ?? planned) : null,
    platform,
    plannedPlatform: plannedPlatform !== platform ? plannedPlatform : null,
    cancelled: (event.realtimeStatus ?? []).some((s) => s.includes("CANCEL")),
    lineColor: null,
    lineTextColor: null,
    notices,
  };
}

export async function departures(
  globalId: string,
  when?: Date,
): Promise<{ stop: Stop; departures: Departure[]; hasRealtime: boolean }> {
  let url = `${BASE}/XML_DM_REQUEST?${COMMON}&type_dm=stop&mode=direct&useRealtime=1&limit=80&name_dm=${encodeURIComponent(globalId)}`;
  if (when) {
    const { date, time } = efaDateTime(when);
    url += `&itdDate=${date}&itdTime=${time}`;
  }
  const data = await fetchJson<{ locations?: VrrLocation[]; stopEvents?: VrrStopEvent[] }>(
    "vrr",
    url,
  );
  const location = data.locations?.[0];
  if (!location) throw new Error("not_found");
  const events = data.stopEvents ?? [];
  return {
    stop: toStop(location),
    departures: events.map(toDeparture).filter((d): d is Departure => d !== null),
    hasRealtime: events.some((e) => e.isRealtimeControlled),
  };
}
