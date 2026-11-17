// Optionen der Verbindungssuche: gemeinsam für App (URL der API) und Worker (Validierung)
import type { TransportMode } from "./api-types";

export type TransferSpeed = "fast" | "normal" | "slow";

/** Routenwahl (#101): schnellste, wenige Umstiege oder wenig Fußweg (nur VRR) */
export type RoutePreference = "fastest" | "fewTransfers" | "lessWalking";

export interface JourneyOptions {
  /** Verkehrsmittel, die nicht genutzt werden sollen */
  exclude: TransportMode[];
  /** Höchstzahl Umstiege, null = beliebig */
  maxTransfers: number | null;
  /** Umstiegszeit: schnell, normal oder mit mehr Puffer */
  transferSpeed: TransferSpeed;
  /** Rollstuhl: alles stufenfrei (ohne Treppen und Rolltreppen, Niederflur) */
  accessible: boolean;
  /** Einzelne Merkmale der Barrierefreiheit (#101) */
  noStairs: boolean;
  noEscalators: boolean;
  lowFloor: boolean;
  /** Routenwahl (nur VRR) */
  route: RoutePreference;
  /** Fahrrad mitnehmen (nur VRR) */
  bike: boolean;
  /** Haltestellen in der Nähe von Start und Ziel einbeziehen (nur VRR) */
  nearbyStops: boolean;
  /** Über diese Haltestelle (ID wie `Stop.id`), null = direkt */
  via: string | null;
  /** Aufenthalt am Zwischenhalt in Minuten */
  viaMinutes: number;
}

export const DEFAULT_JOURNEY_OPTIONS: JourneyOptions = {
  exclude: [],
  maxTransfers: null,
  transferSpeed: "normal",
  accessible: false,
  noStairs: false,
  noEscalators: false,
  lowFloor: false,
  route: "fastest",
  bike: false,
  nearbyStops: false,
  via: null,
  viaMinutes: 0,
};

/** Längster Aufenthalt am Zwischenhalt (Minuten) */
export const MAX_VIA_MINUTES = 120;
/** Haltestellen-ID für „über“ (wie in der API) */
const VIA_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;

const ROUTES = new Set<string>(["fastest", "fewTransfers", "lessWalking"]);

function isRoute(value: string): value is RoutePreference {
  return ROUTES.has(value);
}

/** „1“/„0“/fehlt → boolean, sonst null (ungültig) */
function flag(params: URLSearchParams, key: string): boolean | null {
  const value = params.get(key);
  if (value === null || value === "0") return false;
  return value === "1" ? true : null;
}

/** Verkehrsmittel, die sich ausschließen lassen (Reihenfolge = Anzeige) */
export const EXCLUDABLE_MODES: readonly TransportMode[] = [
  "longdistance",
  "regional",
  "suburban",
  "subway",
  "tram",
  "bus",
  "ferry",
];

export const MAX_TRANSFERS_LIMIT = 5;

const SPEEDS = new Set<string>(["fast", "normal", "slow"]);

function isTransferSpeed(value: string): value is TransferSpeed {
  return SPEEDS.has(value);
}

function isExcludable(value: string): value is TransportMode {
  return EXCLUDABLE_MODES.some((m) => m === value);
}

/**
 * API-Parameter: `exclude=bus,tram`, `maxTransfers=1`, `transfer=slow`, `accessible=1`,
 * `noStairs=1`, `noEscalators=1`, `lowFloor=1`, `route=lessWalking`, `bike=1`, `nearby=1`,
 * `via=<ID>`, `viaStay=<Minuten>`
 */
export function journeyOptionsToParams(options: JourneyOptions, params = new URLSearchParams()) {
  const exclude = EXCLUDABLE_MODES.filter((m) => options.exclude.includes(m));
  if (exclude.length > 0) params.set("exclude", exclude.join(","));
  if (options.maxTransfers !== null) params.set("maxTransfers", String(options.maxTransfers));
  if (options.transferSpeed !== "normal") params.set("transfer", options.transferSpeed);
  if (options.accessible) params.set("accessible", "1");
  if (options.noStairs) params.set("noStairs", "1");
  if (options.noEscalators) params.set("noEscalators", "1");
  if (options.lowFloor) params.set("lowFloor", "1");
  if (options.route !== "fastest") params.set("route", options.route);
  if (options.bike) params.set("bike", "1");
  if (options.nearbyStops) params.set("nearby", "1");
  if (options.via) {
    params.set("via", options.via);
    if (options.viaMinutes > 0) params.set("viaStay", String(options.viaMinutes));
  }
  return params;
}

/** Liest die Optionen, `null` bei ungültigen Werten */
export function journeyOptionsFromParams(params: URLSearchParams): JourneyOptions | null {
  const exclude: TransportMode[] = [];
  for (const raw of (params.get("exclude") ?? "").split(",").filter(Boolean)) {
    if (!isExcludable(raw)) return null;
    if (!exclude.includes(raw)) exclude.push(raw);
  }
  // Alles ausschließen ergibt keine Verbindung
  if (exclude.length === EXCLUDABLE_MODES.length) return null;

  let maxTransfers: number | null = null;
  const max = params.get("maxTransfers");
  if (max !== null) {
    if (!/^\d$/.test(max) || Number(max) > MAX_TRANSFERS_LIMIT) return null;
    maxTransfers = Number(max);
  }

  const speed = params.get("transfer") ?? "normal";
  if (!isTransferSpeed(speed)) return null;

  const accessible = flag(params, "accessible");
  const noStairs = flag(params, "noStairs");
  const noEscalators = flag(params, "noEscalators");
  const lowFloor = flag(params, "lowFloor");
  const bike = flag(params, "bike");
  const nearbyStops = flag(params, "nearby");
  if (
    accessible === null ||
    noStairs === null ||
    noEscalators === null ||
    lowFloor === null ||
    bike === null ||
    nearbyStops === null
  ) {
    return null;
  }

  const route = params.get("route") ?? "fastest";
  if (!isRoute(route)) return null;

  const via = params.get("via");
  if (via !== null && !VIA_ID.test(via)) return null;
  const stay = params.get("viaStay");
  let viaMinutes = 0;
  if (stay !== null) {
    if (via === null || !/^\d{1,3}$/.test(stay) || Number(stay) > MAX_VIA_MINUTES) return null;
    viaMinutes = Number(stay);
  }

  return {
    exclude,
    maxTransfers,
    transferSpeed: speed,
    accessible,
    noStairs,
    noEscalators,
    lowFloor,
    route,
    bike,
    nearbyStops,
    via,
    viaMinutes,
  };
}

/** Kurzer, stabiler Schlüssel (Cache) */
export function journeyOptionsKey(options: JourneyOptions): string {
  return journeyOptionsToParams(options).toString() || "-";
}
