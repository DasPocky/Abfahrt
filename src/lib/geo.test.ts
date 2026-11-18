import { describe, expect, it } from "vitest";
import type { Stop } from "../../shared/api-types";
import { distanceKm, formatDistance, MAX_PLACE_HITS, rankPlaces, rankStops } from "./geo";

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

function stop(id: string, lat: number): Stop {
  return { id, name: id, lat, lon: 6.7763 };
}

function address(id: string, lat: number): Stop {
  return { id, name: id, lat, lon: 6.7763, kind: "address", relevance: 1000 };
}

describe("rankPlaces (#119)", () => {
  const here = { lat: 51.2254, lon: 6.7763 };
  const hits = [
    address("Adresse nah", 51.2255),
    stop("Haltestelle weit", 51.6),
    address("Adresse 2", 51.23),
    address("Adresse 3", 51.24),
    address("Adresse 4", 51.25),
    stop("Haltestelle nah", 51.226),
  ];

  it("stellt Haltestellen vor Adressen, auch wenn Adressen näher und passender sind", () => {
    const names = rankPlaces(hits, here, "Heinrich").map((r) => r.stop.name);
    expect(names.slice(0, 2)).toEqual(["Haltestelle nah", "Haltestelle weit"]);
    expect(names.slice(2)).toHaveLength(MAX_PLACE_HITS);
    expect(names[2]).toBe("Adresse nah");
  });

  it("stellt Adressen vorn hin, wenn die Eingabe auf eine Hausnummer endet", () => {
    expect(rankPlaces(hits, here, "Königsallee 12a")[0]?.stop.name).toBe("Adresse nah");
    expect(rankPlaces(hits, here, "Bahnstr. 3")[0]?.stop.name).toBe("Adresse nah");
  });

  it("kommt ohne Standort aus", () => {
    const names = rankPlaces(hits, null, "Heinrich").map((r) => r.stop.name);
    expect(names.slice(0, 2)).toEqual(["Haltestelle weit", "Haltestelle nah"]);
  });
});
