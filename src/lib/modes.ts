import type { TransportMode } from "../../shared/api-types";

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
