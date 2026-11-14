// Filter für Abfahrten: Verkehrsmittel, Linien, Gleise, Zeitpunkt. Reine Logik + URL-Format.
import type { Departure, TransportMode } from "../../shared/api-types";
import { MODE_LABEL } from "@/lib/modes";

export interface DepartureFilter {
  modes: TransportMode[];
  lines: string[];
  platforms: string[];
  /** ISO-Zeitpunkt für „ab Uhrzeit“, sonst jetzt */
  time?: string;
}

export const EMPTY_FILTER: DepartureFilter = { modes: [], lines: [], platforms: [] };

/** Anzeigereihenfolge der Verkehrsmittel (schnelle Schiene zuerst) */
const MODE_ORDER: TransportMode[] = [
  "longdistance",
  "regional",
  "suburban",
  "subway",
  "tram",
  "bus",
  "ferry",
  "other",
];

const isMode = (value: string): value is TransportMode =>
  (MODE_ORDER as readonly string[]).includes(value);

export function isEmptyFilter(filter: DepartureFilter): boolean {
  return filter.modes.length === 0 && filter.lines.length === 0 && filter.platforms.length === 0;
}

export function filterDepartures(
  departures: readonly Departure[],
  filter: DepartureFilter,
): Departure[] {
  return departures.filter(
    (d) =>
      (filter.modes.length === 0 || filter.modes.includes(d.mode)) &&
      (filter.lines.length === 0 || filter.lines.includes(d.line)) &&
      (filter.platforms.length === 0 ||
        (d.platform !== null && filter.platforms.includes(d.platform))),
  );
}

export function availableModes(departures: readonly Departure[]): TransportMode[] {
  const present = new Set(departures.map((d) => d.mode));
  return MODE_ORDER.filter((m) => present.has(m));
}

const byNatural = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true });

export function availableLines(
  departures: readonly Departure[],
  modes: readonly TransportMode[] = [],
): string[] {
  const lines = new Set(
    departures.filter((d) => modes.length === 0 || modes.includes(d.mode)).map((d) => d.line),
  );
  return [...lines].toSorted(byNatural);
}

export function availablePlatforms(
  departures: readonly Departure[],
  modes: readonly TransportMode[] = [],
): string[] {
  const platforms = new Set(
    departures
      .filter((d) => modes.length === 0 || modes.includes(d.mode))
      .flatMap((d) => (d.platform ? [d.platform] : [])),
  );
  return [...platforms].toSorted(byNatural);
}

export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Kurzbeschreibung, z. B. „S-Bahn“, „U79, U75“, „Gleis 3“ */
export function describeFilter(filter: DepartureFilter): string {
  const parts: string[] = [];
  if (filter.modes.length > 0) {
    parts.push(
      MODE_ORDER.filter((m) => filter.modes.includes(m))
        .map((m) => MODE_LABEL[m])
        .join(", "),
    );
  }
  if (filter.lines.length > 0) parts.push(filter.lines.join(", "));
  if (filter.platforms.length > 0) parts.push(`Gleis ${filter.platforms.join(", ")}`);
  return parts.join(" · ");
}

// ---- URL-Format: ?vm=suburban,regional&linie=S1,S6&gleis=1,2&zeit=2026-11-14T07:00:00.000Z ----

const PARAM = { modes: "vm", lines: "linie", platforms: "gleis", time: "zeit" } as const;
const MAX_ITEMS = 30;
const MAX_VALUE_LENGTH = 20;

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= MAX_VALUE_LENGTH);
  return [...new Set(values)].slice(0, MAX_ITEMS);
}

export function filterFromParams(params: URLSearchParams): DepartureFilter {
  const time = params.get(PARAM.time);
  const parsedTime =
    time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : undefined;
  return {
    modes: readList(params, PARAM.modes).filter(isMode),
    lines: readList(params, PARAM.lines),
    platforms: readList(params, PARAM.platforms),
    ...(parsedTime ? { time: parsedTime } : {}),
  };
}

/** Stabile Form (sortiert), damit gleiche Filter gleich aussehen */
export function filterToParams(filter: DepartureFilter, includeTime = true): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, values: readonly string[]) => {
    if (values.length > 0) params.set(key, values.toSorted(byNatural).join(","));
  };
  set(PARAM.modes, filter.modes);
  set(PARAM.lines, filter.lines);
  set(PARAM.platforms, filter.platforms);
  if (includeTime && filter.time) params.set(PARAM.time, filter.time);
  return params;
}

/** Schlüssel für gespeicherte Ansichten; der Zeitpunkt gehört nicht dazu */
export function filterKey(filter: DepartureFilter): string {
  return filterToParams(filter, false).toString();
}
