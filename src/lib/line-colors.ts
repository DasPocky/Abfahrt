// Farbwahl für Linien-Badges: Linienfarbe aus der API, sonst Fallback nach Verkehrsmittel.
import type { Departure, TransportMode } from "../../shared/api-types";

/** Fallback-Farben je Verkehrsmittel (Tailwind-Klassen, kontrastreich in Hell und Dunkel) */
export const MODE_BADGE_CLASS: Record<TransportMode, string> = {
  tram: "bg-red-600 text-white",
  subway: "bg-blue-700 text-white",
  bus: "bg-violet-700 text-white",
  suburban: "bg-emerald-700 text-white",
  regional: "bg-neutral-600 text-white",
  longdistance: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900",
  ferry: "bg-sky-700 text-white",
  other: "bg-secondary text-secondary-foreground",
};

const HEX = /^[0-9a-f]{6}$/i;

/** Normalisiert eine Hex-Farbe (mit oder ohne „#“) zu „#rrggbb“; ungültige Werte ergeben null */
export function parseHexColor(value: string | null): string | null {
  if (value === null) return null;
  const hex = value.trim().replace(/^#/, "");
  return HEX.test(hex) ? `#${hex.toLowerCase()}` : null;
}

/** Relative Leuchtdichte nach WCAG 2.x für „#rrggbb“ */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Schwarz oder Weiß, je nachdem was auf dem Hintergrund den höheren Kontrast hat */
export function contrastTextColor(background: string): "#000000" | "#ffffff" {
  const l = relativeLuminance(background);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

export interface LineBadgeColors {
  /** Tailwind-Klassen für den Fallback */
  className?: string;
  /** Farben aus der API; React setzt sie per CSSOM, das ist mit style-src 'self' erlaubt */
  style?: { backgroundColor: string; color: string };
}

/** Farben für das Linien-Badge einer Abfahrt */
export function lineBadgeColors(
  departure: Pick<Departure, "mode" | "lineColor" | "lineTextColor">,
): LineBadgeColors {
  const background = parseHexColor(departure.lineColor);
  if (background === null) return { className: MODE_BADGE_CLASS[departure.mode] };
  const text = parseHexColor(departure.lineTextColor) ?? contrastTextColor(background);
  return { style: { backgroundColor: background, color: text } };
}
