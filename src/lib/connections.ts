// Umstiege einer Verbindung: Umstiegszeit und gefährdete Anschlüsse (reine Funktionen, getestet)
import { formatDuration, isLegCancelled } from "@/lib/journeys";
import type { Journey, JourneyLeg, JourneyStop, TransportMode } from "../../shared/api-types";

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

export const TRANSFER_RISK_TEXT = {
  tight: "Anschluss gefährdet",
  missed: "Anschluss nicht erreichbar",
} as const;

/** „5 Min Umstieg“ (bei Fußweg der Puffer danach); null ohne Zeiten oder bei Ausfall */
export function formatTransfer(transfer: Transfer): string | null {
  if (transfer.minutes === null || transfer.status === "unknown") return null;
  const minutes = `${transfer.minutes} Min Umstieg`;
  if (transfer.status === "missed") {
    return `${TRANSFER_RISK_TEXT.missed} · ${-transfer.minutes} Min zu knapp`;
  }
  if (transfer.status === "tight") return `${TRANSFER_RISK_TEXT.tight} · ${minutes}`;
  return minutes;
}

/** Daten für das Linien-Badge eines Fahrt-Abschnitts */
export function legBadge(leg: JourneyLeg) {
  return {
    line: leg.line ?? "?",
    mode: leg.mode ?? ("other" satisfies TransportMode),
    lineColor: leg.lineColor,
    lineTextColor: leg.lineTextColor,
  };
}

/** „Fußweg 4 Min · 250 m“ */
export function walkText(leg: JourneyLeg): string {
  const parts = [`Fußweg ${formatDuration(leg.durationMinutes)}`];
  if (leg.distanceMeters !== null) parts.push(`${Math.round(leg.distanceMeters)} m`);
  return parts.join(" · ");
}
