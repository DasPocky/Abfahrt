// Fahrtverlauf (#120): Halte einer Fahrt, wo sie gerade ist. Rein und getestet.
import type { JourneyLeg, JourneyStop } from "../../shared/api-types";
import { formatCountdown } from "@/lib/time";

export function tripStops(leg: JourneyLeg): JourneyStop[] {
  return [leg.origin, ...leg.intermediateStops, leg.destination];
}

/** Abfahrt am Halt (am Ziel: Ankunft), Echtzeit vor Plan */
export function stopTime(stop: JourneyStop): number {
  return Date.parse(
    stop.realtimeDeparture ??
      stop.plannedDeparture ??
      stop.realtimeArrival ??
      stop.plannedArrival ??
      "",
  );
}

export type TripProgress =
  | { state: "before" }
  | { state: "after" }
  /** zwischen Halt `index` (abgefahren) und `index + 1` */
  | { state: "between"; index: number };

/** Wo ist die Fahrt? Nach Abfahrt (bzw. Ankunft am Ziel) gilt ein Halt als passiert. */
export function tripProgress(stops: readonly JourneyStop[], now: Date): TripProgress {
  const t = now.getTime();
  let last = -1;
  stops.forEach((stop, index) => {
    const time = stopTime(stop);
    if (Number.isFinite(time) && time <= t) last = index;
  });
  if (last < 0) return { state: "before" };
  if (last >= stops.length - 1) return { state: "after" };
  return { state: "between", index: last };
}

/** Index des Halts mit dieser Haltestellen-ID (Steig egal), sonst -1 */
export function stopIndex(stops: readonly JourneyStop[], stopId: string | null): number {
  if (!stopId) return -1;
  // „vrr:de:05111:18036“ passt auch zu „vrr:de:05111:18036:8:4“ und zu „transitous:…_de:05111:18036…“
  const dhid = dhidOf(stopId);
  return stops.findIndex((s) => s.id === stopId || (dhid !== null && dhidOf(s.id) === dhid));
}

function dhidOf(id: string | null): string | null {
  return id ? (/de:\d{5}:\d+/.exec(id)?.[0] ?? null) : null;
}

/** „in 6 Min“, „jetzt“ oder „um 12:40“ */
function when(time: number, now: Date): string {
  const text = formatCountdown(new Date(time), now);
  return text === "jetzt" || text.startsWith("in ") ? text : `um ${text}`;
}

/**
 * Kurze Statuszeile (#120): wann die Fahrt an der eigenen Haltestelle ist, sonst der nächste Halt
 * bzw. die Abfahrt am Start; „Fahrt beendet“ nach der Ankunft am Ziel.
 */
export function tripStatus(stops: readonly JourneyStop[], fromIndex: number, now: Date): string {
  const progress = tripProgress(stops, now);
  if (progress.state === "after") return "Fahrt beendet";
  const passedUpTo = progress.state === "between" ? progress.index : -1;
  const from = stops[fromIndex];
  if (from && fromIndex > passedUpTo) return `An ${from.name} ${when(stopTime(from), now)}`;
  const next = stops[passedUpTo + 1];
  if (!next) return "";
  return passedUpTo < 0
    ? `Abfahrt ab ${next.name} ${when(stopTime(next), now)}`
    : `Nächster Halt ${next.name} ${when(stopTime(next), now)}`;
}
