// Fahrtverlauf (#120): Halte einer Fahrt, wo sie gerade ist. Rein und getestet.
import type { JourneyLeg, JourneyStop } from "../../shared/api-types";

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
