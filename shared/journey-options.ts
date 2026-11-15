// Optionen der Verbindungssuche: gemeinsam für App (URL der API) und Worker (Validierung)
import type { TransportMode } from "./api-types";

export type TransferSpeed = "fast" | "normal" | "slow";

export interface JourneyOptions {
  /** Verkehrsmittel, die nicht genutzt werden sollen */
  exclude: TransportMode[];
  /** Höchstzahl Umstiege, null = beliebig */
  maxTransfers: number | null;
  /** Umstiegszeit: schnell, normal oder mit mehr Puffer */
  transferSpeed: TransferSpeed;
  /** Barrierefrei: stufenfrei, mit Aufzug, Niederflur */
  accessible: boolean;
}

export const DEFAULT_JOURNEY_OPTIONS: JourneyOptions = {
  exclude: [],
  maxTransfers: null,
  transferSpeed: "normal",
  accessible: false,
};

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

/** API-Parameter: `exclude=bus,tram`, `maxTransfers=1`, `transfer=slow`, `accessible=1` */
export function journeyOptionsToParams(options: JourneyOptions, params = new URLSearchParams()) {
  const exclude = EXCLUDABLE_MODES.filter((m) => options.exclude.includes(m));
  if (exclude.length > 0) params.set("exclude", exclude.join(","));
  if (options.maxTransfers !== null) params.set("maxTransfers", String(options.maxTransfers));
  if (options.transferSpeed !== "normal") params.set("transfer", options.transferSpeed);
  if (options.accessible) params.set("accessible", "1");
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

  const accessible = params.get("accessible");
  if (accessible !== null && accessible !== "1" && accessible !== "0") return null;

  return { exclude, maxTransfers, transferSpeed: speed, accessible: accessible === "1" };
}

/** Kurzer, stabiler Schlüssel (Cache) */
export function journeyOptionsKey(options: JourneyOptions): string {
  return journeyOptionsToParams(options).toString() || "-";
}
