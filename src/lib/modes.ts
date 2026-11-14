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
 * Bezeichnung des Halteplatzes: Schienenverkehr (auch U-Bahn) „Gleis“, Bus/Tram „Steig“.
 * Welches Gleis gemeint ist (Bahn oder U-Bahn), zeigt die Linie davor.
 */
export function platformLabel(mode: TransportMode): string {
  switch (mode) {
    case "suburban":
    case "regional":
    case "longdistance":
    case "subway":
      return "Gleis";
    case "ferry":
      return "Anleger";
    default:
      return "Steig";
  }
}
