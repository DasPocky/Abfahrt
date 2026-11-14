import type { TransportMode } from "../../shared/api-types";

/** Kurzbezeichnung für Filter-Chips */
export const MODE_SHORT: Record<TransportMode, string> = {
  tram: "Tram",
  subway: "U-Bahn",
  bus: "Bus",
  suburban: "S-Bahn",
  regional: "Regio",
  longdistance: "Fern",
  ferry: "Fähre",
  other: "Sonst.",
};

/** Bezeichnung der Verkehrsmittel für Screenreader und Tooltips */
export const MODE_LABEL: Record<TransportMode, string> = {
  tram: "Straßenbahn",
  subway: "U-Bahn",
  bus: "Bus",
  suburban: "S-Bahn",
  regional: "Regionalzug",
  longdistance: "Fernzug",
  ferry: "Fähre",
  other: "Sonstiges",
};

/** Art des Halteplatz-Piktogramms (wie auf den Schildern vor Ort) */
export type PlatformKind = "track" | "subway" | "stop" | "pier";

export function platformKind(mode: TransportMode): PlatformKind {
  switch (mode) {
    case "suburban":
    case "regional":
    case "longdistance":
      return "track";
    case "subway":
      return "subway";
    case "ferry":
      return "pier";
    default:
      return "stop";
  }
}

/**
 * Ausgeschriebene Bezeichnung des Halteplatzes (für Screenreader und Tooltips). An Knoten wie
 * dem Hbf gibt es „Gleis 2“ der Bahn und „Gleis 2“ der U-Bahn, daher „U-Bahn-Gleis“.
 */
export function platformLabel(mode: TransportMode): string {
  return { track: "Gleis", subway: "U-Bahn-Gleis", stop: "Steig", pier: "Anleger" }[
    platformKind(mode)
  ];
}
