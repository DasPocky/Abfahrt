// Umstiege einer Verbindung: Umstiegszeit und gefährdete Anschlüsse (reine Funktionen, getestet)
import { formatDuration } from "@/lib/journeys";
import type { JourneyLeg, TransportMode } from "../../shared/api-types";
import type { Transfer } from "../../shared/transfers";

export {
  journeyTransferRisk,
  journeyTransfers,
  TIGHT_TRANSFER_MINUTES,
  transferStatus,
  type Transfer,
  type TransferStatus,
} from "../../shared/transfers";

export const TRANSFER_RISK_TEXT = {
  tight: "Anschluss gefährdet",
  missed: "Anschluss nicht erreichbar",
} as const;

/** „5 Min Umstieg“ (bei Fußweg der Puffer danach); null ohne Zeiten oder bei Ausfall */
export function formatTransfer(transfer: Transfer): string | null {
  if (transfer.minutes === null || transfer.status === "unknown") return null;
  const minutes = `${transfer.minutes} Min Umstieg${transfer.samePlatform ? " · selber Steig" : ""}`;
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
