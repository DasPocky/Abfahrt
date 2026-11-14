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

/**
 * Bezeichnung des Halteplatzes je Verkehrsmittel. An Knoten wie dem Hbf gibt es „Gleis 2“
 * der Bahn und „Gleis 2“ der U-Bahn, daher für U-Bahn/Stadtbahn ausdrücklich „U-Gleis“.
 */
export function platformLabel(mode: TransportMode): string {
  switch (mode) {
    case "suburban":
    case "regional":
    case "longdistance":
      return "Gleis";
    case "subway":
      return "U-Gleis";
    case "ferry":
      return "Anleger";
    default:
      return "Steig";
  }
}
