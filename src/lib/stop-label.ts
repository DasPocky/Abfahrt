import type { Stop } from "../../shared/api-types";

/**
 * Eindeutiger Anzeigename einer Haltestelle für Eingabefelder und Links: der Ort wird
 * angehängt, wenn er nicht schon im Namen steckt („Hauptbahnhof, Essen“, aber „Düsseldorf Hbf“).
 */
export function stopLabel(stop: Pick<Stop, "name" | "place">): string {
  const { name, place } = stop;
  if (!place || name.toLowerCase().includes(place.toLowerCase())) return name;
  return `${name}, ${place}`;
}
