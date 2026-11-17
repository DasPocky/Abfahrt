// Umstiege und Ausfälle einer Verbindung (reine Funktionen, von App und Worker genutzt)
import type { Journey, JourneyLeg, JourneyStop } from "./api-types";

/** Fällt eine Fahrt oder ein genutzter Halt aus, ist der Abschnitt nicht fahrbar */
export function isLegCancelled(leg: JourneyLeg): boolean {
  return leg.cancelled || leg.origin.cancelled || leg.destination.cancelled;
}

export function isJourneyCancelled(journey: Journey): boolean {
  return journey.legs.some((leg) => leg.kind === "transit" && isLegCancelled(leg));
}

/** Fahrten mit Linie und geplanter Abfahrt am Einstieg, z. B. „U76@…|S6@…“ (Wiedererkennung) */
export function journeySignature(journey: Journey): string {
  return journey.legs
    .filter((l) => l.kind === "transit")
    .map((l) => `${l.line ?? ""}@${l.origin.plannedDeparture ?? ""}`)
    .join("|");
}

/** Unter so vielen Minuten Puffer gilt ein Anschluss als gefährdet */
export const TIGHT_TRANSFER_MINUTES = 2;

const MINUTE_MS = 60_000;

/**
 * - `ok`: genug Zeit
 * - `tight`: weniger als {@link TIGHT_TRANSFER_MINUTES} Minuten Puffer
 * - `missed`: rechnerisch nicht erreichbar (Puffer negativ)
 * - `unknown`: Zeiten fehlen oder eine der Fahrten fällt aus
 */
export type TransferStatus = "ok" | "tight" | "missed" | "unknown";

export interface Transfer {
  /** Index (in `journey.legs`) der ankommenden Fahrt */
  fromLeg: number;
  /** Index der abfahrenden Fahrt */
  toLeg: number;
  /** Summe der Fußwege dazwischen laut Plan */
  walkMinutes: number;
  /** Puffer: Abfahrt − Ankunft − Fußwege in ganzen Minuten, null ohne Zeiten */
  minutes: number | null;
  status: TransferStatus;
  /** Ankunft und Abfahrt an derselben Haltestelle und am selben Steig/Gleis, ohne Fußweg (#97) */
  samePlatform: boolean;
}

/** Gleicher Halt (ID, sonst Name) und gleicher Steig laut Echtzeit bzw. Plan */
function sameStopAndPlatform(a: JourneyStop, b: JourneyStop): boolean {
  const sameStop = a.id !== null && b.id !== null ? a.id === b.id : a.name === b.name;
  return sameStop && a.platform !== null && a.platform === b.platform;
}

/** Echtzeit, sonst Plan */
function effective(planned: string | null, realtime: string | null): number | null {
  const value = Date.parse(realtime ?? planned ?? "");
  return Number.isNaN(value) ? null : value;
}

function arrivalAt(stop: JourneyStop): number | null {
  return effective(stop.plannedArrival, stop.realtimeArrival);
}

function departureAt(stop: JourneyStop): number | null {
  return effective(stop.plannedDeparture, stop.realtimeDeparture);
}

export function transferStatus(minutes: number | null): TransferStatus {
  if (minutes === null) return "unknown";
  if (minutes < 0) return "missed";
  if (minutes < TIGHT_TRANSFER_MINUTES) return "tight";
  return "ok";
}

/**
 * Umstiege zwischen je zwei aufeinanderfolgenden Fahrten. Fußwege dazwischen werden von der
 * verfügbaren Zeit abgezogen; Fußwege am Anfang oder Ende sind keine Umstiege.
 */
export function journeyTransfers(journey: Journey): Transfer[] {
  const transfers: Transfer[] = [];
  let previous: number | null = null;
  let walkMinutes = 0;
  journey.legs.forEach((leg, index) => {
    if (leg.kind === "walk") {
      if (previous !== null) walkMinutes += Math.max(0, leg.durationMinutes);
      return;
    }
    if (previous !== null) {
      const from = journey.legs[previous]!;
      const arrival = arrivalAt(from.destination);
      const departure = departureAt(leg.origin);
      const cancelled = isLegCancelled(from) || isLegCancelled(leg);
      const walked = index - previous > 1;
      const minutes =
        arrival === null || departure === null
          ? null
          : Math.round((departure - arrival) / MINUTE_MS) - walkMinutes;
      transfers.push({
        fromLeg: previous,
        toLeg: index,
        walkMinutes,
        minutes,
        status: cancelled ? "unknown" : transferStatus(minutes),
        samePlatform: !walked && sameStopAndPlatform(from.destination, leg.origin),
      });
    }
    previous = index;
    walkMinutes = 0;
  });
  return transfers;
}

/** Schlechtester Anschluss der Verbindung: `missed` vor `tight`, sonst null */
export function journeyTransferRisk(journey: Journey): "tight" | "missed" | null {
  const statuses = journeyTransfers(journey).map((t) => t.status);
  if (statuses.includes("missed")) return "missed";
  if (statuses.includes("tight")) return "tight";
  return null;
}

/** Mindestens ein Umstieg, und alle am selben Steig (#97) */
export function hasOnlySamePlatformTransfers(journey: Journey): boolean {
  const transfers = journeyTransfers(journey);
  return transfers.length > 0 && transfers.every((t) => t.samePlatform);
}
