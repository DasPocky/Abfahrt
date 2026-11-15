// Verbindungssuche: URL-Parameter und Anzeige-Hilfen (reine Funktionen, getestet)
import type { Journey, JourneyLeg, TransportMode } from "../../shared/api-types";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  MAX_TRANSFERS_LIMIT,
  type JourneyOptions,
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
  /** Verkehrsmittel, Umstiege, Umstiegszeit, barrierefrei */
  options: JourneyOptions;
}

export const EMPTY_JOURNEY_QUERY: JourneyQuery = {
  from: null,
  to: null,
  arrive: false,
  options: DEFAULT_JOURNEY_OPTIONS,
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
} as const;

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
  return {
    // nicht alles ausschließen, sonst gibt es keine Verbindung
    exclude: exclude.length < EXCLUDABLE_MODES.length ? [...new Set(exclude)] : [],
    maxTransfers,
    transferSpeed,
    accessible: params.get(PARAM.accessible) === "1",
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
}

/** Anzahl abweichender Optionen (für das Symbol am Optionen-Knopf) */
export function countJourneyOptions(options: JourneyOptions): number {
  return (
    (options.exclude.length > 0 ? 1 : 0) +
    (options.maxTransfers !== null ? 1 : 0) +
    (options.transferSpeed !== "normal" ? 1 : 0) +
    (options.accessible ? 1 : 0)
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
  return parts.join(" · ");
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
  return params;
}

/** Pfad der Verbindungssuche (relativ zum Router-basename) */
export function journeyPath(query: JourneyQuery = EMPTY_JOURNEY_QUERY): string {
  const search = journeyQueryToParams(query).toString();
  return search ? `/verbindung?${search}` : "/verbindung";
}

/** Start und Ziel vertauschen */
export function swapJourneyQuery(query: JourneyQuery): JourneyQuery {
  return { ...query, from: query.to, to: query.from };
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
export function isLegCancelled(leg: JourneyLeg): boolean {
  return leg.cancelled || leg.origin.cancelled || leg.destination.cancelled;
}

export function isJourneyCancelled(journey: Journey): boolean {
  return journey.legs.some((leg) => leg.kind === "transit" && isLegCancelled(leg));
}

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
