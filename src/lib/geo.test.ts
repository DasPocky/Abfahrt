import { describe, expect, it } from "vitest";
import type { Stop } from "../../shared/api-types";
import { distanceKm, formatDistance, rankStops } from "./geo";

const DUESSELDORF = { lat: 51.2254, lon: 6.7763 };

// Gekürzte echte Treffer des VRR-Stopfinders (14.11.2026)
const HOLTHAUSEN: Stop[] = [
  { id: "vrr:essen", name: "Holthausen Bf", place: "Essen", lat: 51.4, lon: 7.1, relevance: 980 },
  {
    id: "vrr:ddorf",
    name: "Holthausen",
    place: "Düsseldorf",
    lat: 51.17,
    lon: 6.84,
    relevance: 895,
  },
  {
    id: "vrr:wenholt",
    name: "Friedhof",
    place: "Wenholthausen",
    lat: 51.3,
    lon: 8.15,
    relevance: 865,
  },
];
const HAUPTBAHNHOF: Stop[] = [
  { id: "vrr:ge", name: "Hbf", place: "Gelsenkirchen", lat: 51.505, lon: 7.102, relevance: 998 },
  { id: "vrr:e", name: "Hauptbahnhof", place: "Essen", lat: 51.451, lon: 7.014, relevance: 998 },
  {
    id: "vrr:d",
    name: "Düsseldorf Hbf",
    place: "Düsseldorf",
    lat: 51.22,
    lon: 6.794,
    relevance: 990,
  },
  { id: "vrr:ne", name: "Hauptbahnhof", place: "Neuss", lat: 51.205, lon: 6.684, relevance: 990 },
];

describe("Entfernung", () => {
  it("berechnet Luftlinie in km", () => {
    expect(distanceKm(DUESSELDORF, { lat: 51.4, lon: 7.1 })).toBeCloseTo(29.8, 0);
  });

  it("formatiert Meter und Kilometer", () => {
    expect(formatDistance(0.012)).toBe("50 m");
    expect(formatDistance(0.83)).toBe("850 m");
    expect(formatDistance(6.84)).toBe("6,8 km");
    expect(formatDistance(29.8)).toBe("30 km");
  });
});

describe("rankStops", () => {
  it("behält ohne Standort die Reihenfolge der Quelle", () => {
    expect(rankStops(HOLTHAUSEN, null).map((r) => r.stop.id)).toEqual([
      "vrr:essen",
      "vrr:ddorf",
      "vrr:wenholt",
    ]);
    expect(rankStops(HOLTHAUSEN, null)[0]?.distanceKm).toBeNull();
  });

  it("bringt mit Standort Düsseldorf das nahe Holthausen nach vorn", () => {
    const ranked = rankStops(HOLTHAUSEN, DUESSELDORF);
    expect(ranked[0]?.stop.id).toBe("vrr:ddorf");
    expect(ranked[0]?.distanceKm).toBeGreaterThan(5);
    expect(ranked[0]?.distanceKm).toBeLessThan(10);
  });

  it("bringt beim Suchwort „Hauptbahnhof“ den Düsseldorfer Hbf nach vorn", () => {
    expect(
      rankStops(HAUPTBAHNHOF, DUESSELDORF)
        .map((r) => r.stop.id)
        .slice(0, 2),
    ).toEqual(["vrr:d", "vrr:ne"]);
  });

  it("schlechte Treffer bleiben trotz Nähe hinten", () => {
    const stops: Stop[] = [
      { id: "gut", name: "Gut", lat: 51.4, lon: 7.1, relevance: 990 },
      { id: "nah", name: "Nah, aber unpassend", lat: 51.2255, lon: 6.7764, relevance: 200 },
    ];
    expect(rankStops(stops, DUESSELDORF)[0]?.stop.id).toBe("gut");
  });

  it("begrenzt die Anzahl", () => {
    expect(rankStops(HAUPTBAHNHOF, DUESSELDORF, 2)).toHaveLength(2);
  });
});
