// Aufbereitung von Haltestellen- und Zielnamen aus den Quellen (#90, #94)
import { sameCity } from "../shared/places";

export { sameCity };

/**
 * Städtekürzel in DELFI-/VRR-Namen („D-Holthausen“, „DU-Meiderich Süd Bf“). Nur diese bekannten
 * Kürzel werden aufgelöst, alles andere bleibt unverändert (kein Raten).
 */
const CITY_PREFIXES: Record<string, string> = {
  BO: "Bochum",
  BOT: "Bottrop",
  D: "Düsseldorf",
  DO: "Dortmund",
  DU: "Duisburg",
  E: "Essen",
  GE: "Gelsenkirchen",
  HA: "Hagen",
  HER: "Herne",
  K: "Köln",
  KR: "Krefeld",
  MG: "Mönchengladbach",
  MH: "Mülheim",
  NE: "Neuss",
  OB: "Oberhausen",
  RS: "Remscheid",
  SG: "Solingen",
  W: "Wuppertal",
};

const PREFIX = /^([A-ZÄÖÜ]{1,3})-(?!Bahn)(?=[A-ZÄÖÜ0-9])/u;

/** „D-Holthausen“ → { name: "Holthausen", city: "Düsseldorf" }; ohne bekanntes Kürzel city null */
export function splitCityPrefix(raw: string): { name: string; city: string | null } {
  const match = PREFIX.exec(raw);
  const city = match ? CITY_PREFIXES[match[1] ?? ""] : undefined;
  return city && match ? { name: raw.slice(match[0].length), city } : { name: raw, city: null };
}

/**
 * Entfernt ein bekanntes Städtekürzel („D-Heinrich-Heine-Allee U“ → „Heinrich-Heine-Allee U“).
 * Für Haltestellennamen, deren Ort separat steht (`place`). „S-Bahnhof …“ bleibt unverändert.
 */
export function stripCityPrefix(name: string): string {
  return splitCityPrefix(name).name;
}

/**
 * Fahrtziel für die Anzeige an einem Halt in `context` (Stadt des Halts): in derselben Stadt ohne
 * Ort („D-Benrath Btf“ in Düsseldorf → „Benrath Btf“), sonst mit Ort vorn („D-Holthausen“ in
 * Krefeld → „Düsseldorf Holthausen“, wie „Duisburg Uni Nord“ anderer Verkehrsunternehmen).
 * Ist die Stadt des Halts unbekannt, bleibt der Ort stehen.
 */
export function directionAt(raw: string, context: string | null | undefined): string {
  const { name, city } = splitCityPrefix(raw);
  if (!city) return raw;
  return sameCity(city, context) ? name : `${city} ${name}`;
}
