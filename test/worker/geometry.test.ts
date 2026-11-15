import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodePolyline,
  legPath,
  MAX_PATH_POINTS,
  pathFromStops,
  simplifyPath,
  type LatLon,
} from "../../worker/geometry";
import * as transitousTrips from "../../worker/sources/transitous-trips";
import * as vrrTrips from "../../worker/sources/vrr-trips";
import transitousPlanGeometry from "./fixtures/transitous-plan-geometry.json";
import transitousPlan from "./fixtures/transitous-plan.json";
import vrrTripCoords from "./fixtures/vrr-trip-coords.json";
import vrrTrip from "./fixtures/vrr-trip.json";

const HHA = "vrr:de:05111:18036";
const ESSEN = "vrr:de:05113:9289";
const BERLIN = "transitous:de-DELFI_de:11000:900003201";

function mockUpstream(body: unknown) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(body));
}

afterEach(() => vi.restoreAllMocks());

/** Gegenstück zur Dekodierung, nur für die Tests */
function encodePolyline(points: readonly LatLon[], precision: number): string {
  const factor = 10 ** precision;
  let out = "";
  let prevLat = 0;
  let prevLon = 0;
  const encode = (value: number) => {
    let v = value < 0 ? -value * 2 - 1 : value * 2;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v % 32)) + 63);
      v = Math.floor(v / 32);
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of points) {
    const iLat = Math.round(lat * factor);
    const iLon = Math.round(lon * factor);
    encode(iLat - prevLat);
    encode(iLon - prevLon);
    prevLat = iLat;
    prevLon = iLon;
  }
  return out;
}

/** Auf `places` Nachkommastellen gerundet, für Vergleiche ohne Rundungsrauschen */
function rounded(points: readonly LatLon[], places: number): LatLon[] {
  const f = 10 ** places;
  return points.map(([lat, lon]) => [Math.round(lat * f) / f, Math.round(lon * f) / f]);
}

/** Grober Abstand in Metern */
function meters(a: LatLon, b: LatLon): number {
  const dLat = (a[0] - b[0]) * 111_320;
  const dLon = (a[1] - b[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

describe("Polyline-Dekodierung", () => {
  it("dekodiert das Google-Beispiel (Präzision 5)", () => {
    expect(rounded(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), 6)).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("dekodiert Präzision 6 und 7, auch über 32 Bit hinaus", () => {
    const points: LatLon[] = [
      [51.2261234, 6.7767891],
      [52.5250839, 13.369402],
      [-33.8688197, 151.2092955],
      [64.1465, -21.9426],
    ];
    expect(rounded(decodePolyline(encodePolyline(points, 6), 6), 6)).toEqual(rounded(points, 6));
    expect(rounded(decodePolyline(encodePolyline(points, 7), 7), 7)).toEqual(points);
  });

  it("liefert bei abgeschnittener Eingabe die vollständigen Punkte", () => {
    const encoded = encodePolyline(
      [
        [51.1, 6.7],
        [51.2, 6.8],
      ],
      6,
    );
    expect(decodePolyline(encoded.slice(0, -2), 6)).toHaveLength(1);
    expect(decodePolyline("", 6)).toEqual([]);
  });
});

describe("Ausdünnen", () => {
  it("rundet auf 5 Nachkommastellen und lässt Doppelte und Ungültiges weg", () => {
    expect(
      simplifyPath([
        [51.123456, 6.987654],
        [51.123457, 6.987651],
        [Number.NaN, 6.9],
        [91, 6.9],
        [51.2, 7.0],
      ]),
    ).toEqual([
      [51.12346, 6.98765],
      [51.2, 7],
    ]);
  });

  it("vereinfacht Geraden und begrenzt auf höchstens 200 Punkte, Anfang und Ende bleiben", () => {
    const line: LatLon[] = Array.from({ length: 1000 }, (_, i) => [51 + i * 0.001, 6.5]);
    expect(simplifyPath(line)).toEqual([
      [51, 6.5],
      [51.999, 6.5],
    ]);

    // Zickzack mit 300 m Ausschlag: Vereinfachung allein reicht nicht
    const zigzag: LatLon[] = Array.from({ length: 5000 }, (_, i) => [
      51 + i * 0.0001,
      6.5 + (i % 2) * 0.004,
    ]);
    const result = simplifyPath(zigzag);
    expect(result.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
    expect(result.length).toBeGreaterThan(100);
    expect(result[0]).toEqual([51, 6.5]);
    expect(result.at(-1)).toEqual([51.4999, 6.504]);
  });

  it("verbindet ohne Geometrie die Halte, unbekannt bleibt null", () => {
    const stops = [{ lat: 51.1, lon: 6.7 }, {}, { lat: 51.2, lon: 6.8 }];
    expect(pathFromStops(stops)).toEqual([
      [51.1, 6.7],
      [51.2, 6.8],
    ]);
    expect(legPath(null, stops)).toEqual([
      [51.1, 6.7],
      [51.2, 6.8],
    ]);
    expect(legPath([[51.1, 6.7]], stops)).toHaveLength(2);
    expect(legPath(undefined, [{ lat: 51.1, lon: 6.7 }])).toBeNull();
  });
});

describe("Streckenverlauf in den Adaptern", () => {
  it("VRR: übernimmt `coords` je Abschnitt", async () => {
    mockUpstream(vrrTripCoords);
    const [journey] = (await vrrTrips.trips(HHA, ESSEN, undefined, false)).journeys;
    const [u75, re1] = journey?.legs ?? [];
    expect(u75?.line).toBe("U75");
    expect(re1?.line).toBe("RE1");
    for (const leg of [u75, re1]) {
      const path = leg?.path ?? [];
      expect(path.length).toBeGreaterThan(5);
      expect(path.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
      for (const [lat, lon] of path) {
        expect(Math.round(lat * 1e5) / 1e5).toBe(lat);
        expect(Math.round(lon * 1e5) / 1e5).toBe(lon);
      }
      // Verlauf beginnt und endet am jeweiligen Halt
      const { origin, destination } = leg!;
      expect(meters(path[0]!, [origin.lat!, origin.lon!])).toBeLessThan(300);
      expect(meters(path.at(-1)!, [destination.lat!, destination.lon!])).toBeLessThan(300);
    }
    // 570 Punkte der Quelle passen ausgedünnt in deutlich weniger
    expect(re1!.path!.length).toBeLessThan(570);
  });

  it("VRR: ohne `coords` verbindet der Verlauf die Halte", async () => {
    mockUpstream(vrrTrip);
    const journey = (await vrrTrips.trips(HHA, ESSEN, undefined, false)).journeys[2];
    const s6 = journey?.legs[1];
    expect(s6?.path).toHaveLength((s6?.intermediateStops.length ?? 0) + 2);
    expect(s6?.path?.[0]?.[0]).toBeCloseTo(s6?.origin.lat ?? 0, 5);
    expect(s6?.path?.[0]?.[1]).toBeCloseTo(s6?.origin.lon ?? 0, 5);
  });

  it("Transitous: dekodiert `legGeometry` (Präzision aus der Antwort)", async () => {
    mockUpstream(transitousPlanGeometry);
    const [journey] = (await transitousTrips.trips(HHA, BERLIN, undefined, false)).journeys;
    const legs = journey?.legs ?? [];
    expect(legs.map((l) => l.line ?? l.kind)).toEqual([
      "U78",
      "walk",
      "ICE 723",
      "walk",
      "ICE 278",
    ]);
    for (const leg of legs.filter((l) => l.kind === "transit")) {
      const path = leg.path ?? [];
      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
      expect(meters(path[0]!, [leg.origin.lat!, leg.origin.lon!])).toBeLessThan(300);
      expect(meters(path.at(-1)!, [leg.destination.lat!, leg.destination.lon!])).toBeLessThan(300);
    }
    // ICE 278 hat über 8.000 Punkte, Fußwege keine Geometrie (gerade Linie)
    expect(legs[4]!.path!.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
    expect(legs[4]!.path!.length).toBeGreaterThan(50);
    expect(legs[1]!.path).toEqual([
      [51.21954, 6.79427],
      [51.21954, 6.79478],
    ]);
    // Umstieg am selben Punkt: kein Verlauf
    expect(legs[3]!.path).toBeNull();
  });

  it("Transitous: ohne `legGeometry` verbindet der Verlauf die Halte", async () => {
    mockUpstream(transitousPlan);
    const [journey] = (await transitousTrips.trips(HHA, BERLIN, undefined, false)).journeys;
    const ice = journey?.legs[2];
    expect(ice?.path).toHaveLength((ice?.intermediateStops.length ?? 0) + 2);
  });
});
