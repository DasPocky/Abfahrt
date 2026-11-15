// Streckenverlauf je Abschnitt für die Routenkarte (`JourneyLeg.path`), siehe docs/02-architektur.md

/** Punkt als `[lat, lon]` */
export type LatLon = [number, number];

/** Höchstens so viele Punkte je Abschnitt, damit die Antwort klein bleibt */
export const MAX_PATH_POINTS = 200;
/** Kleinste Toleranz der Vereinfachung in Grad Breite (ca. 5 m), darunter fällt nichts auf */
const MIN_TOLERANCE = 0.00005;
/**
 * Toleranz wächst mit der Länge des Abschnitts (Ausdehnung / 4000): eine 500 km lange ICE-Fahrt
 * passt in die kleine Karte, Abweichungen von ca. 100 m sieht dort niemand
 */
const TOLERANCE_PER_EXTENT = 1 / 4000;

/**
 * Dekodiert eine Encoded Polyline (Google-Format) mit beliebiger Präzision
 * (MOTIS liefert `precision` mit, meist 6 oder 7; Google selbst nutzt 5).
 * Kaputte Eingaben ergeben die bis dahin gelesenen Punkte.
 */
export function decodePolyline(encoded: string, precision = 5): LatLon[] {
  const factor = 10 ** precision;
  const points: LatLon[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      // Multiplikation statt Bitshift: bei Präzision 7 reichen 32 Bit nicht sicher
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20);
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };

  while (index < encoded.length) {
    const dLat = next();
    const dLon = next();
    if (dLat === null || dLon === null) break;
    lat += dLat;
    lon += dLon;
    points.push([lat / factor, lon / factor]);
  }
  return points;
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function isValid([lat, lon]: LatLon): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

/** Abstand von `p` zur Strecke `a`–`b` in Grad Breite (Länge mit cos(Breite) gestaucht) */
function segmentDistance(p: LatLon, a: LatLon, b: LatLon, lonScale: number): number {
  const ax = a[1] * lonScale;
  const ay = a[0];
  const dx = b[1] * lonScale - ax;
  const dy = b[0] - ay;
  const px = p[1] * lonScale - ax;
  const py = p[0] - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len));
  return Math.hypot(px - t * dx, py - t * dy);
}

/** Ramer-Douglas-Peucker, iterativ (lange ICE-Strecken haben über 9.000 Punkte) */
function douglasPeucker(points: LatLon[], tolerance: number): LatLon[] {
  if (points.length <= 2) return points;
  const lonScale = Math.cos(((points[0]?.[0] ?? 0) * Math.PI) / 180);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let maxIndex = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!, lonScale);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxIndex !== -1 && maxDist > tolerance) {
      keep[maxIndex] = 1;
      stack.push([first, maxIndex], [maxIndex, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Größere Seite des umschließenden Rechtecks in Grad (Länge mit cos(Breite) gestaucht) */
function extent(points: readonly LatLon[]): number {
  if (points.length < 2) return 0;
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const lonScale = Math.cos(((lats[0] ?? 0) * Math.PI) / 180);
  return Math.max(
    Math.max(...lats) - Math.min(...lats),
    (Math.max(...lons) - Math.min(...lons)) * lonScale,
  );
}

/** Gleichmäßig auf höchstens `max` Punkte ausdünnen, Anfang und Ende bleiben */
function sample(points: LatLon[], max: number): LatLon[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]!);
}

/** Auf 5 Nachkommastellen runden (ca. 1 m), Ungültiges und doppelte Punkte weglassen */
export function roundPath(points: readonly LatLon[]): LatLon[] {
  const rounded: LatLon[] = [];
  for (const point of points) {
    if (!isValid(point)) continue;
    const p: LatLon = [round5(point[0]), round5(point[1])];
    const prev = rounded.at(-1);
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) rounded.push(p);
  }
  return rounded;
}

/**
 * Macht einen Streckenverlauf klein: runden (`roundPath`), vereinfachen (Douglas-Peucker) und
 * notfalls gleichmäßig ausdünnen.
 */
export function simplifyPath(points: readonly LatLon[], max = MAX_PATH_POINTS): LatLon[] {
  const rounded = roundPath(points);
  const tolerance = Math.max(MIN_TOLERANCE, extent(rounded) * TOLERANCE_PER_EXTENT);
  let result = douglasPeucker(rounded, tolerance);
  // Sehr kurvige Strecken mit bis zu 16-facher Toleranz, danach gleichmäßig ausdünnen
  for (let t = tolerance * 2; result.length > max && t <= tolerance * 16; t *= 2) {
    result = douglasPeucker(result, t);
  }
  return sample(result, max);
}

/** Halt mit (optionaler) Lage, wie `JourneyStop` */
interface Located {
  lat?: number;
  lon?: number;
}

/** Ersatz ohne Geometrie: die Halte (Start, Zwischenhalte, Ziel) verbinden */
export function pathFromStops(stops: readonly Located[]): LatLon[] {
  return stops.flatMap((s) =>
    s.lat === undefined || s.lon === undefined ? [] : [[s.lat, s.lon] as LatLon],
  );
}

/**
 * Streckenverlauf eines Abschnitts: die Geometrie der Quelle, sonst die Halte.
 * Weniger als zwei Punkte ergeben null (unbekannt).
 */
export function legPath(
  geometry: readonly LatLon[] | null | undefined,
  stops: readonly Located[],
): LatLon[] | null {
  let path = simplifyPath(geometry ?? []);
  // Halte nicht vereinfachen: jeder Halt bleibt ein Knick der Linie
  if (path.length < 2) path = sample(roundPath(pathFromStops(stops)), MAX_PATH_POINTS);
  return path.length >= 2 ? path : null;
}
