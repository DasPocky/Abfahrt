// Verweis auf eine einzelne Fahrt (#120): steht an jeder Abfahrt (`Departure.tripRef`) und geht
// unverändert an `/api/trip?ref=…`. Undurchsichtig für die App, nur der Worker liest ihn.
//   EFA:        efa|<Quelle>|<Linien-ID>|<Halt (Steig)>|<tripCode>|<JJJJMMTTHHMM>
//   Transitous: transitous|<tripId>
import type { DataSource } from "../shared/api-types";

export type TripRef =
  | {
      kind: "efa";
      source: EfaSource;
      line: string;
      stop: string;
      tripCode: string;
      date: string;
      time: string;
    }
  | { kind: "transitous"; tripId: string };

const MAX_REF_LENGTH = 300;
type EfaSource = Exclude<DataSource, "transitous">;
const EFA_SOURCES: readonly EfaSource[] = ["vrr", "efa-bw"];

function isEfaSource(value: string): value is EfaSource {
  return EFA_SOURCES.some((s) => s === value);
}

/** 1–120 Zeichen, kein Trenner und keine Steuerzeichen */
function isPart(value: string | undefined): value is string {
  if (!value || value.length > 120 || value.includes("|")) return false;
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) < 32) return false;
  return true;
}

export function efaTripRef(
  source: string,
  line: string | undefined,
  stop: string | undefined,
  tripCode: number | string | undefined,
  dateTime: { date: string; time: string } | null,
): string | undefined {
  if (!line || !stop || tripCode === undefined || !dateTime) return undefined;
  const parts = [line, stop, String(tripCode)];
  if (!parts.every(isPart)) return undefined;
  return ["efa", source, ...parts, `${dateTime.date}${dateTime.time}`].join("|");
}

export function transitousTripRef(tripId: string | undefined): string | undefined {
  return isPart(tripId) ? `transitous|${tripId}` : undefined;
}

export function parseTripRef(raw: string | null): TripRef | null {
  if (!raw || raw.length > MAX_REF_LENGTH) return null;
  const parts = raw.split("|");
  if (parts[0] === "transitous" && parts.length === 2 && isPart(parts[1])) {
    return { kind: "transitous", tripId: parts[1] };
  }
  if (parts[0] !== "efa" || parts.length !== 6) return null;
  const [, source, line, stop, tripCode, when] = parts;
  if (!source || !isEfaSource(source) || !isPart(line) || !isPart(stop)) return null;
  if (!tripCode || !/^\d{1,9}$/.test(tripCode) || !when || !/^\d{12}$/.test(when)) return null;
  return {
    kind: "efa",
    source,
    line,
    stop,
    tripCode,
    date: when.slice(0, 8),
    time: when.slice(8),
  };
}
