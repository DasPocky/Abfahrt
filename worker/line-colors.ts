// Linienfarben für Quellen ohne Farbangabe (VRR-EFA). Die Farben stammen aus Transitous
// (routeColor/routeTextColor aus den offenen GTFS-Daten), siehe docs/01-datenquellen.md.
import type { Departure } from "../shared/api-types";

export interface LineColor {
  color: string;
  textColor: string | null;
}

/** Linienbezeichnung → Farbe, Schlüssel normalisiert (siehe normalizeLineName) */
export type LineColorMap = Record<string, LineColor>;

const HEX = /^[0-9a-f]{6}$/i;

/** Hex-Farbe ohne „#“ in Kleinbuchstaben, ungültige Werte ergeben null */
export function normalizeHex(value: string | undefined | null): string | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, "");
  return HEX.test(hex) ? hex.toLowerCase() : null;
}

/**
 * Vergleichbare Linienbezeichnung: ohne Klammerzusatz, ohne Leerzeichen, Großbuchstaben.
 * „RE 5 (RRX)“, „RE5 (28512)“ und „RE5“ ergeben alle „RE5“.
 */
export function normalizeLineName(line: string): string {
  return line
    .replaceAll(/\([^)]*\)/g, "")
    .replaceAll(/\s+/g, "")
    .toUpperCase();
}

/** Ergänzt fehlende Linienfarben aus der Zuordnung. Ändert das Original nicht. */
export function applyLineColors(departures: Departure[], colors: LineColorMap): Departure[] {
  return departures.map((d) => {
    if (d.lineColor !== null) return d;
    const match = colors[normalizeLineName(d.line)];
    return match ? { ...d, lineColor: match.color, lineTextColor: match.textColor } : d;
  });
}
