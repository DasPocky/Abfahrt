// Daten der Routenkarte (GeoJSON) aus einer Verbindung, ohne MapLibre (testbar in jsdom)
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Journey, JourneyLeg, JourneyStop, TransportMode } from "../../shared/api-types";
import { parseHexColor } from "@/lib/line-colors";

/** Fallback-Linienfarben je Verkehrsmittel, passend zu `MODE_BADGE_CLASS` (Tailwind-Töne) */
const MODE_LINE_COLOR: Record<TransportMode, { light: string; dark: string }> = {
  tram: { light: "#dc2626", dark: "#ef4444" },
  subway: { light: "#1d4ed8", dark: "#3b82f6" },
  bus: { light: "#ca8a04", dark: "#facc15" },
  suburban: { light: "#047857", dark: "#10b981" },
  regional: { light: "#525252", dark: "#a3a3a3" },
  longdistance: { light: "#171717", dark: "#f5f5f5" },
  ferry: { light: "#0369a1", dark: "#0ea5e9" },
  other: { light: "#737373", dark: "#a3a3a3" },
};
const WALK_COLOR = { light: "#737373", dark: "#a3a3a3" };

export type RoutePointKind = "start" | "end" | "transfer";

export interface RouteLineProps {
  color: string;
  walk: boolean;
}

export interface RoutePointProps {
  kind: RoutePointKind;
  name: string;
}

export interface RouteData {
  lines: FeatureCollection<LineString, RouteLineProps>;
  points: FeatureCollection<Point, RoutePointProps>;
  /** `[[west, south], [east, north]]`, null ohne Punkte */
  bounds: [[number, number], [number, number]] | null;
}

/** Linienfarbe eines Abschnitts als „#rrggbb“ */
export function legColor(leg: JourneyLeg, dark: boolean): string {
  const theme = dark ? "dark" : "light";
  if (leg.kind === "walk") return WALK_COLOR[theme];
  return parseHexColor(leg.lineColor) ?? MODE_LINE_COLOR[leg.mode ?? "other"][theme];
}

/** Streckenverlauf als `[lon, lat]` (GeoJSON), ohne Verlauf die Halte des Abschnitts */
function legCoordinates(leg: JourneyLeg): [number, number][] {
  // `path` fehlt in Antworten älterer Worker-Versionen (Cache)
  const path =
    leg.path && leg.path.length >= 2
      ? leg.path
      : [leg.origin, ...leg.intermediateStops, leg.destination].flatMap((s) =>
          s.lat === undefined || s.lon === undefined ? [] : [[s.lat, s.lon] as [number, number]],
        );
  return path.map(([lat, lon]) => [lon, lat]);
}

/** Hat die Verbindung genug Lagedaten für eine Karte? */
export function hasRoute(journey: Journey): boolean {
  return journey.legs.some((leg) => legCoordinates(leg).length >= 2);
}

function point(
  stop: JourneyStop,
  fallback: [number, number] | undefined,
  kind: RoutePointKind,
): Feature<Point, RoutePointProps>[] {
  const coordinates: [number, number] | undefined =
    stop.lat !== undefined && stop.lon !== undefined ? [stop.lon, stop.lat] : fallback;
  return coordinates
    ? [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: { kind, name: stop.name },
        },
      ]
    : [];
}

/**
 * Linien je Abschnitt (Fußwege gestrichelt), Punkte für Start, Ziel und Umstiege (jeder Wechsel
 * zwischen zwei Abschnitten, also Aus- und Einstieg) sowie der Ausschnitt für `fitBounds`.
 */
export function routeData(journey: Journey, dark: boolean): RouteData {
  const lines: Feature<LineString, RouteLineProps>[] = [];
  const points: Feature<Point, RoutePointProps>[] = [];
  const legs = journey.legs;
  legs.forEach((leg, index) => {
    const coordinates = legCoordinates(leg);
    if (coordinates.length >= 2) {
      lines.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { color: legColor(leg, dark), walk: leg.kind === "walk" },
      });
    }
    if (index === 0) points.push(...point(leg.origin, coordinates[0], "start"));
    const last = index === legs.length - 1;
    // Umstieg: Ausstieg am Ende jedes Abschnitts, Einstieg liegt am Anfang des nächsten
    if (!last && leg.kind === "transit") {
      points.push(...point(leg.destination, coordinates.at(-1), "transfer"));
    }
    if (index > 0 && leg.kind === "transit" && legs[index - 1]?.kind === "walk") {
      points.push(...point(leg.origin, coordinates[0], "transfer"));
    }
    if (last) points.push(...point(leg.destination, coordinates.at(-1), "end"));
  });

  const all = [
    ...lines.flatMap((f) => f.geometry.coordinates),
    ...points.map((f) => f.geometry.coordinates),
  ];
  let bounds: RouteData["bounds"] = null;
  if (all.length > 0) {
    const lons = all.map((c) => c[0]!);
    const lats = all.map((c) => c[1]!);
    bounds = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
  }
  return {
    lines: { type: "FeatureCollection", features: lines },
    points: { type: "FeatureCollection", features: points },
    bounds,
  };
}
