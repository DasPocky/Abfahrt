// Verbindungssuche: URL-Parameter und Anzeige-Hilfen (reine Funktionen, getestet)
import type { Journey, TransportMode } from "../../shared/api-types";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  MAX_TRANSFERS_LIMIT,
  MAX_VIA_MINUTES,
  type JourneyOptions,
  type RoutePreference,
  type TransferSpeed,
} from "../../shared/journey-options";
import { MODE_LABEL } from "./modes";
import { DISPLAY_TIME_ZONE, formatClock } from "./time";

/** Gewählte Haltestelle (ID für die API, Name für die Anzeige) */
export interface PickedStop {
  id: string;
  name: string;
}

export interface JourneyQuery {
  from: PickedStop | null;
  to: PickedStop | null;
  /** ISO-8601; fehlt = jetzt */
  time?: string;
  /** true = `time` ist die gewünschte Ankunftszeit */
  arrive: boolean;
  /** Verkehrsmittel, Umstiege, Umstiegszeit, barrierefrei, Route, über … */
  options: JourneyOptions;
  /** Eigene Zwischenhalte in Reihenfolge (#110), höchstens MAX_VIAS */
  vias: ViaStop[];
}

/** Zwischenhalt mit Aufenthalt (#110) */
export interface ViaStop extends PickedStop {
  /** Aufenthalt in Minuten */
  minutes: number;
}

/** Höchstens so viele Zwischenhalte (schont Worker und Quellen: je Etappe eine Suche) */
export const MAX_VIAS = 5;

/** Aufenthalt am Zwischenhalt zur Auswahl (Minuten) */
export const VIA_STAY_CHOICES = [0, 5, 10, 15, 30, 60] as const;

export const EMPTY_JOURNEY_QUERY: JourneyQuery = {
  from: null,
  to: null,
  arrive: false,
  options: DEFAULT_JOURNEY_OPTIONS,
  vias: [],
};

/** Namen der URL-Parameter (deutsch, teilbar) */
const PARAM = {
  from: "von",
  fromName: "vonName",
  to: "nach",
  toName: "nachName",
  time: "zeit",
  arrive: "ankunft",
  exclude: "ohne",
  maxTransfers: "umstiege",
  transferSpeed: "umstiegszeit",
  accessible: "barrierefrei",
  noStairs: "ohneTreppen",
  noEscalators: "ohneRolltreppen",
  lowFloor: "niederflur",
  route: "route",
  bike: "fahrrad",
  nearbyStops: "umgebung",
  via: "ueber",
  viaName: "ueberName",
  viaMinutes: "aufenthalt",
} as const;

/** Routenwahl in der URL auf Deutsch */
const ROUTE_PARAM: Record<RoutePreference, string> = {
  fastest: "",
  fewTransfers: "wenig-umstiege",
  lessWalking: "wenig-fussweg",
};

/** Haltestellen-ID für „über“ */
const VIA_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;

/** Umstiegszeit in der URL auf Deutsch */
const SPEED_PARAM: Record<TransferSpeed, string> = { fast: "kurz", normal: "", slow: "mehr" };

/** Optionen aus der URL; Ungültiges wird still ignoriert (geteilte Links bleiben nutzbar) */
export function journeyOptionsFromUrl(params: URLSearchParams): JourneyOptions {
  const exclude = (params.get(PARAM.exclude) ?? "")
    .split(",")
    .filter((m): m is TransportMode => EXCLUDABLE_MODES.some((e) => e === m));
  const max = params.get(PARAM.maxTransfers);
  const maxTransfers =
    max !== null && /^\d$/.test(max) && Number(max) <= MAX_TRANSFERS_LIMIT ? Number(max) : null;
  const speed = params.get(PARAM.transferSpeed);
  const transferSpeed: TransferSpeed =
    speed === SPEED_PARAM.fast ? "fast" : speed === SPEED_PARAM.slow ? "slow" : "normal";
  const routeRaw = params.get(PARAM.route) ?? "";
  const route: RoutePreference =
    routeRaw === ROUTE_PARAM.fewTransfers
      ? "fewTransfers"
      : routeRaw === ROUTE_PARAM.lessWalking
        ? "lessWalking"
        : "fastest";
  const on = (key: string) => params.get(key) === "1";
  return {
    // nicht alles ausschließen, sonst gibt es keine Verbindung
    exclude: exclude.length < EXCLUDABLE_MODES.length ? [...new Set(exclude)] : [],
    maxTransfers,
    transferSpeed,
    accessible: on(PARAM.accessible),
    noStairs: on(PARAM.noStairs),
    noEscalators: on(PARAM.noEscalators),
    lowFloor: on(PARAM.lowFloor),
    route,
    bike: on(PARAM.bike),
    nearbyStops: on(PARAM.nearbyStops),
    // Zwischenhalte stehen in `JourneyQuery.vias`; `apiOptions` setzt sie für die API
    via: null,
    viaMinutes: 0,
  };
}

function journeyOptionsToUrl(options: JourneyOptions, params: URLSearchParams): void {
  const exclude = EXCLUDABLE_MODES.filter((m) => options.exclude.includes(m));
  if (exclude.length > 0) params.set(PARAM.exclude, exclude.join(","));
  if (options.maxTransfers !== null) params.set(PARAM.maxTransfers, String(options.maxTransfers));
  if (options.transferSpeed !== "normal") {
    params.set(PARAM.transferSpeed, SPEED_PARAM[options.transferSpeed]);
  }
  if (options.accessible) params.set(PARAM.accessible, "1");
  if (options.noStairs) params.set(PARAM.noStairs, "1");
  if (options.noEscalators) params.set(PARAM.noEscalators, "1");
  if (options.lowFloor) params.set(PARAM.lowFloor, "1");
  if (options.route !== "fastest") params.set(PARAM.route, ROUTE_PARAM[options.route]);
  if (options.bike) params.set(PARAM.bike, "1");
  if (options.nearbyStops) params.set(PARAM.nearbyStops, "1");
}

/** Anzahl abweichender Optionen (für das Symbol am Optionen-Knopf) */
export function countJourneyOptions(options: JourneyOptions): number {
  return (
    (options.exclude.length > 0 ? 1 : 0) +
    (options.maxTransfers !== null ? 1 : 0) +
    (options.transferSpeed !== "normal" ? 1 : 0) +
    (options.accessible ? 1 : 0) +
    (options.noStairs || options.noEscalators || options.lowFloor ? 1 : 0) +
    (options.route !== "fastest" ? 1 : 0) +
    (options.bike ? 1 : 0) +
    (options.nearbyStops ? 1 : 0)
  );
}

/** Kurze Beschreibung, z. B. „ohne Fernzug, Bus · max. 1 Umstieg · barrierefrei“ */
export function describeJourneyOptions(options: JourneyOptions): string {
  const parts: string[] = [];
  if (options.exclude.length > 0) {
    const names = EXCLUDABLE_MODES.filter((m) => options.exclude.includes(m)).map(
      (m) => MODE_LABEL[m],
    );
    parts.push(`ohne ${names.join(", ")}`);
  }
  if (options.maxTransfers === 0) parts.push("nur direkt");
  else if (options.maxTransfers !== null) {
    parts.push(
      `max. ${options.maxTransfers} ${options.maxTransfers === 1 ? "Umstieg" : "Umstiege"}`,
    );
  }
  if (options.transferSpeed === "fast") parts.push("kurze Umstiege");
  if (options.transferSpeed === "slow") parts.push("mehr Umstiegszeit");
  if (options.accessible) parts.push("barrierefrei");
  else {
    if (options.noStairs) parts.push("ohne Treppen");
    if (options.noEscalators) parts.push("ohne Rolltreppen");
    if (options.lowFloor) parts.push("Niederflur");
  }
  if (options.route === "fewTransfers") parts.push("wenige Umstiege");
  if (options.route === "lessWalking") parts.push("wenig Fußweg");
  if (options.bike) parts.push("mit Fahrrad");
  if (options.nearbyStops) parts.push("Haltestellen in der Nähe");
  return parts.join(" · ");
}

/** Zwischenhalte aus der URL: `ueber`, `ueberName`, `aufenthalt` je Halt wiederholt (#110) */
function viasFromParams(params: URLSearchParams): ViaStop[] {
  const names = params.getAll(PARAM.viaName);
  const stays = params.getAll(PARAM.viaMinutes);
  return params
    .getAll(PARAM.via)
    .map((raw, i) => {
      const stay = Number(stays[i]);
      return {
        id: raw.trim(),
        name: names[i]?.trim() ?? "",
        minutes: Number.isInteger(stay) && stay > 0 && stay <= MAX_VIA_MINUTES ? stay : 0,
      };
    })
    .filter((v) => VIA_ID.test(v.id))
    .slice(0, MAX_VIAS);
}

/**
 * Optionen für die API: genau ein Zwischenhalt geht in einer Abfrage mit (`via`), mehrere sucht die
 * App in Etappen (`journeyLegs`).
 */
export function apiOptions(query: JourneyQuery): JourneyOptions {
  const [only] = query.vias;
  return query.vias.length === 1 && only
    ? { ...query.options, via: only.id, viaMinutes: only.minutes }
    : { ...query.options, via: null, viaMinutes: 0 };
}

/** Etappen bei mehreren Zwischenhalten: Start → 1, 1 → 2, …, letzter → Ziel */
export function journeyLegs(
  query: JourneyQuery,
): { from: PickedStop; to: PickedStop; stay: number }[] {
  if (!query.from || !query.to) return [];
  const points: (PickedStop & { minutes: number })[] = [
    { ...query.from, minutes: 0 },
    ...query.vias,
    { ...query.to, minutes: 0 },
  ];
  return points.slice(1).map((to, i) => ({
    from: points[i]!,
    to,
    // Aufenthalt am Start der Etappe (am Zwischenhalt davor)
    stay: points[i]!.minutes,
  }));
}

function stopFromParams(params: URLSearchParams, idKey: string, nameKey: string) {
  const id = params.get(idKey)?.trim();
  if (!id) return null;
  return { id, name: params.get(nameKey)?.trim() ?? "" };
}

export function journeyQueryFromParams(params: URLSearchParams): JourneyQuery {
  const time = params.get(PARAM.time);
  const parsed = time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : undefined;
  return {
    from: stopFromParams(params, PARAM.from, PARAM.fromName),
    to: stopFromParams(params, PARAM.to, PARAM.toName),
    ...(parsed ? { time: parsed } : {}),
    // Ankunft ohne Zeitpunkt ergibt keinen Sinn, dann gilt „ab jetzt“
    arrive: parsed !== undefined && params.get(PARAM.arrive) === "1",
    options: journeyOptionsFromUrl(params),
    vias: viasFromParams(params),
  };
}

export function journeyQueryToParams(query: JourneyQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.from) {
    params.set(PARAM.from, query.from.id);
    if (query.from.name) params.set(PARAM.fromName, query.from.name);
  }
  if (query.to) {
    params.set(PARAM.to, query.to.id);
    if (query.to.name) params.set(PARAM.toName, query.to.name);
  }
  if (query.time) {
    params.set(PARAM.time, query.time);
    if (query.arrive) params.set(PARAM.arrive, "1");
  }
  journeyOptionsToUrl(query.options, params);
  for (const via of query.vias.slice(0, MAX_VIAS)) {
    params.append(PARAM.via, via.id);
    params.append(PARAM.viaName, via.name);
    params.append(PARAM.viaMinutes, String(via.minutes));
  }
  return params;
}

/** Pfad der Verbindungssuche (relativ zum Router-basename) */
export function journeyPath(query: JourneyQuery = EMPTY_JOURNEY_QUERY): string {
  const search = journeyQueryToParams(query).toString();
  return search ? `/verbindung?${search}` : "/verbindung";
}

/** Start und Ziel vertauschen, Zwischenhalte in umgekehrter Reihenfolge */
export function swapJourneyQuery(query: JourneyQuery): JourneyQuery {
  return { ...query, from: query.to, to: query.from, vias: query.vias.toReversed() };
}

/** Dauer kompakt: „42 Min“, „1 Std“, „1 Std 5 Min“ */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} Min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} Std` : `${hours} Std ${rest} Min`;
}

export function formatTransfers(transfers: number): string {
  if (transfers === 0) return "direkt";
  return transfers === 1 ? "1 Umstieg" : `${transfers} Umstiege`;
}

export interface JourneyTimes {
  plannedDeparture: string | null;
  realtimeDeparture: string | null;
  plannedArrival: string | null;
  realtimeArrival: string | null;
}

/** Abfahrt am Start und Ankunft am Ziel der ganzen Verbindung */
export function journeyTimes(journey: Journey): JourneyTimes {
  const first = journey.legs[0]?.origin;
  const last = journey.legs.at(-1)?.destination;
  return {
    plannedDeparture: first?.plannedDeparture ?? null,
    realtimeDeparture: first?.realtimeDeparture ?? null,
    plannedArrival: last?.plannedArrival ?? null,
    realtimeArrival: last?.realtimeArrival ?? null,
  };
}

/** Fällt eine Fahrt oder ein genutzter Halt aus, ist die Verbindung nicht fahrbar */
export { isJourneyCancelled, isLegCancelled } from "../../shared/transfers";

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE });
const WEEKDAY_DATE = new Intl.DateTimeFormat("de-DE", {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

/** Beschriftung des Zeit-Chips: „Ab jetzt“, „Ab 08:15“, „An morgen 08:15“, „Ab Mo., 17.11. 08:15“ */
export function timeChipLabel(time: string | undefined, arrive: boolean, now: Date): string {
  if (time === undefined) return "Ab jetzt";
  const date = new Date(time);
  const prefix = arrive ? "An" : "Ab";
  const day = DAY_KEY.format(date);
  const today = DAY_KEY.format(now);
  const tomorrow = DAY_KEY.format(new Date(now.getTime() + 24 * 60 * 60_000));
  const dayText =
    day === today ? "" : day === tomorrow ? "morgen " : `${WEEKDAY_DATE.format(date)} `;
  return `${prefix} ${dayText}${formatClock(date)}`;
}
