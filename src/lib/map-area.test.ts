import { describe, expect, it } from "vitest";
import type { StopPlatform } from "../../shared/api-types";
import {
  areaForBounds,
  MAX_AREA_LAT,
  MAX_AREA_LON,
  STOPS_MIN_ZOOM,
  platformDeparturesPath,
  mergeRadiusMeters,
  metersPerPixel,
  platformGroups,
  platformSummary,
  selectionKey,
} from "./map-area";

const SMALL = { west: 6.77012, south: 51.22049, east: 6.78488, north: 51.22951 };

describe("areaForBounds", () => {
  it("rundet den Ausschnitt nach außen auf 3 Nachkommastellen", () => {
    expect(areaForBounds(SMALL, 15)).toEqual({ min: "51.220,6.770", max: "51.230,6.785" });
  });

  it("lädt erst ab der Mindest-Zoomstufe", () => {
    expect(areaForBounds(SMALL, STOPS_MIN_ZOOM - 0.1)).toBeNull();
    expect(areaForBounds(SMALL, STOPS_MIN_ZOOM)).not.toBeNull();
  });

  it("beschneidet breite Fenster um die Mitte auf die erlaubte Größe", () => {
    const wide = { west: 6.7, south: 51.2, east: 6.9, north: 51.3 };
    const area = areaForBounds(wide, 14)!;
    const [minLat = 0, minLon = 0] = area.min.split(",").map(Number);
    const [maxLat = 0, maxLon = 0] = area.max.split(",").map(Number);
    // Worker-Grenze 0,05° × 0,08°, Rundung nach außen kostet höchstens 0,002°
    expect(maxLat - minLat).toBeLessThanOrEqual(0.05);
    expect(maxLon - minLon).toBeLessThanOrEqual(0.08);
    expect(maxLat - minLat).toBeGreaterThanOrEqual(MAX_AREA_LAT);
    expect(maxLon - minLon).toBeGreaterThanOrEqual(MAX_AREA_LON);
    expect((minLat + maxLat) / 2).toBeCloseTo(51.25, 2);
    expect((minLon + maxLon) / 2).toBeCloseTo(6.8, 2);
  });
});

describe("Steige auf der Karte (#84)", () => {
  it("beschreibt einen Steig und verlinkt seine Abfahrten", () => {
    const platform = { track: "1", lat: 51.24, lon: 6.84, modes: ["subway" as const] };
    expect(platformSummary(platform)).toBe("Steig 1 · U-Bahn");
    expect(platformSummary({ ...platform, track: "12", modes: ["suburban" as const] })).toBe(
      "Gleis 12 · S-Bahn",
    );
    expect(platformDeparturesPath("/haltestelle/x", platform)).toBe("/haltestelle/x?gleis=1");
    expect(platformDeparturesPath("/haltestelle/x", null)).toBe("/haltestelle/x");
    expect(selectionKey("vrr:a", "1")).toBe("vrr:a|1");
  });
});

describe("Steiggruppen je Zoomstufe (#86)", () => {
  // Auf der Hardt/LVR-Klinikum (echte Lagen): 1/2 unten (U73), 3–6 oben an der Hauptstraße
  const HARDT: StopPlatform[] = [
    { track: "1", lat: 51.240376, lon: 6.843923, modes: ["subway"] },
    { track: "2", lat: 51.24007, lon: 6.844444, modes: ["subway"] },
    { track: "3", lat: 51.241238, lon: 6.844022, modes: ["subway", "tram"] },
    { track: "4", lat: 51.24137, lon: 6.844579, modes: ["subway", "tram"] },
    { track: "5", lat: 51.241325, lon: 6.844632, modes: ["bus"] },
    { track: "6", lat: 51.241257, lon: 6.844552, modes: ["bus"] },
  ];
  const tracksAt = (zoom: number) =>
    platformGroups(HARDT, mergeRadiusMeters(zoom, 51.24)).map((g) =>
      g.platforms.map((p) => p.track),
    );

  it("rechnet Bildschirmpixel in Meter um", () => {
    // Zoom 16 in Düsseldorf: knapp 0,75 m je Pixel
    expect(metersPerPixel(16, 51.24)).toBeCloseTo(0.748, 2);
    expect(mergeRadiusMeters(15, 51.24)).toBeCloseTo(2 * mergeRadiusMeters(16, 51.24), 6);
  });

  it("fasst nur zusammen, was man auf der Karte nicht mehr getrennt sieht", () => {
    expect(tracksAt(12)).toEqual([["1", "2", "3", "4", "5", "6"]]);
    // Zoom 15: die gut 40 m auseinanderliegenden Steige getrennt, 4–6 (unter 10 m) ein Punkt
    expect(tracksAt(15)).toEqual([["1"], ["2"], ["3"], ["4", "5", "6"]]);
    expect(tracksAt(18)).toHaveLength(6);
  });

  it("mischt die Verkehrsmittel einer Gruppe, wichtigstes zuerst", () => {
    expect(platformGroups(HARDT, 1000)[0]?.modes).toEqual(["subway", "tram", "bus"]);
  });

  it("verbindet Ketten naher Steige zu einer Gruppe", () => {
    const groups = platformGroups(
      [
        { track: "a", lat: 51, lon: 7, modes: [] },
        { track: "c", lat: 51.0008, lon: 7, modes: [] },
        { track: "b", lat: 51.0004, lon: 7, modes: [] },
      ],
      60,
    );
    expect(groups).toHaveLength(1);
  });
});
