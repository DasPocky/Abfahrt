import { describe, expect, it } from "vitest";
import { hasRoute, legColor, routeData } from "./route-map";
import { journey, journeyLeg, journeyStop } from "../test-utils";

const U79 = journeyLeg({
  origin: journeyStop({ name: "Hbf", lat: 51.22, lon: 6.79 }),
  destination: journeyStop({ name: "Heinrich-Heine-Allee", lat: 51.226, lon: 6.777 }),
  path: [
    [51.22, 6.79],
    [51.223, 6.785],
    [51.226, 6.777],
  ],
});
const WALK = journeyLeg({
  kind: "walk",
  line: null,
  mode: null,
  origin: journeyStop({ name: "Heinrich-Heine-Allee", lat: 51.226, lon: 6.777 }),
  destination: journeyStop({ name: "Heinrich-Heine-Allee (Bus)", lat: 51.2265, lon: 6.7775 }),
  path: [
    [51.226, 6.777],
    [51.2265, 6.7775],
  ],
});
const BUS = journeyLeg({
  line: "732",
  mode: "bus",
  lineColor: "00A0E3",
  origin: journeyStop({ name: "Heinrich-Heine-Allee (Bus)", lat: 51.2265, lon: 6.7775 }),
  intermediateStops: [journeyStop({ name: "Mitte", lat: 51.23, lon: 6.76 })],
  destination: journeyStop({ name: "Nordpark", lat: 51.25, lon: 6.75 }),
  path: null,
});

describe("Routenkarte", () => {
  it("färbt Abschnitte nach Linie, sonst nach Verkehrsmittel, Fußwege grau", () => {
    expect(legColor(BUS, false)).toBe("#00a0e3");
    expect(legColor(U79, false)).toBe("#1d4ed8");
    expect(legColor(U79, true)).toBe("#3b82f6");
    expect(legColor({ ...U79, mode: "longdistance" }, true)).toBe("#f5f5f5");
    expect(legColor(WALK, false)).toBe("#737373");
  });

  it("baut Linien, Punkte für Start, Umstiege und Ziel sowie den Ausschnitt", () => {
    const data = routeData(journey({ id: "j", legs: [U79, WALK, BUS] }), false);
    expect(data.lines.features.map((f) => f.properties)).toEqual([
      { color: "#1d4ed8", walk: false },
      { color: "#737373", walk: true },
      { color: "#00a0e3", walk: false },
    ]);
    // GeoJSON: [lon, lat]
    expect(data.lines.features[0]?.geometry.coordinates[1]).toEqual([6.785, 51.223]);
    // Ohne Verlauf: die Halte verbunden
    expect(data.lines.features[2]?.geometry.coordinates).toEqual([
      [6.7775, 51.2265],
      [6.76, 51.23],
      [6.75, 51.25],
    ]);
    expect(data.points.features.map((f) => [f.properties.kind, f.properties.name])).toEqual([
      ["start", "Hbf"],
      ["transfer", "Heinrich-Heine-Allee"],
      ["transfer", "Heinrich-Heine-Allee (Bus)"],
      ["end", "Nordpark"],
    ]);
    expect(data.bounds).toEqual([
      [6.75, 51.22],
      [6.79, 51.25],
    ]);
  });

  it("erkennt Verbindungen ohne Lagedaten", () => {
    expect(hasRoute(journey({ id: "a", legs: [U79] }))).toBe(true);
    const unknown = journeyLeg({
      origin: journeyStop({ name: "A" }),
      destination: journeyStop({ name: "B" }),
    });
    expect(hasRoute(journey({ id: "b", legs: [unknown] }))).toBe(false);
    expect(routeData(journey({ id: "b", legs: [unknown] }), false).bounds).toBeNull();
  });
});
