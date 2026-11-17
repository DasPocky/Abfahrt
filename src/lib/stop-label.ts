import type { Stop } from "../../shared/api-types";
import { sameCity } from "../../shared/places";

/**
 * Eindeutiger Anzeigename einer Haltestelle für Eingabefelder und Links: der Ort wird
 * angehängt, wenn er nicht schon im Namen steckt („Hauptbahnhof, Essen“, aber „Düsseldorf Hbf“).
 */
export function stopLabel(stop: Pick<Stop, "name" | "place">): string {
  const { name, place } = stop;
  if (!place || name.toLowerCase().includes(place.toLowerCase())) return name;
  return `${name}, ${place}`;
}

/**
 * Ort eines Halts für die Anzeige in einer Verbindung (#94): nur wenn er nicht in `home` liegt
 * (Stadt des Starts), z. B. von Dortmund nach „Holthausen“ → „Düsseldorf“. Ohne bekannte
 * Startstadt steht der Ort immer dabei.
 */
export function otherPlace(
  place: string | null | undefined,
  home: string | null | undefined,
): string | null {
  return place && !sameCity(place, home) ? place : null;
}
