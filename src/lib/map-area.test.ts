import { describe, expect, it } from "vitest";
import { areaForBounds, MAX_AREA_LAT, MAX_AREA_LON, STOPS_MIN_ZOOM } from "./map-area";

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
