import { describe, expect, it } from "vitest";
import type { VehicleSegment } from "../../shared/api-types";
import { pointAlong, vehiclePositions } from "./vehicles";

function segment(part: Partial<VehicleSegment>): VehicleSegment {
  return {
    trip: "t1",
    line: "U73",
    mode: "subway",
    color: null,
    departure: "2026-11-17T09:00:00Z",
    arrival: "2026-11-17T09:02:00Z",
    realtime: true,
    delayMinutes: 1,
    nextStop: "B",
    path: [
      [51, 7],
      [51, 7.01],
    ],
    ...part,
  };
}

const at = (time: string) => Date.parse(`2026-11-17T${time}Z`);

describe("Position entlang der Strecke", () => {
  it("teilt die Strecke nach Länge, nicht nach Punkten", () => {
    const path: [number, number][] = [
      [51, 7],
      [51, 7.001],
      [51, 7.01],
    ];
    expect(pointAlong(path, 0)).toEqual([51, 7]);
    expect(pointAlong(path, 1)).toEqual([51, 7.01]);
    expect(pointAlong(path, 0.5)[1]).toBeCloseTo(7.005, 6);
    expect(pointAlong(path, 2)).toEqual([51, 7.01]);
  });
});

describe("Fahrzeugpositionen (#92)", () => {
  const first = segment({});
  const second = segment({
    departure: "2026-11-17T09:03:00Z",
    arrival: "2026-11-17T09:05:00Z",
    nextStop: "C",
    path: [
      [51, 7.01],
      [51, 7.02],
    ],
  });

  it("schiebt das Fahrzeug nach der Zeit über den Abschnitt", () => {
    const [v] = vehiclePositions([second, first], at("09:01:00"));
    expect(v).toMatchObject({ line: "U73", nextStop: "B", atStop: false });
    expect(v?.lon).toBeCloseTo(7.005, 6);
  });

  it("lässt es zwischen zwei Abschnitten am Halt stehen", () => {
    const [v] = vehiclePositions([first, second], at("09:02:30"));
    expect(v).toMatchObject({ lat: 51, lon: 7.01, atStop: true, nextStop: "B" });
  });

  it("zeigt es kurz vor der ersten Abfahrt am Starthalt, vorher und danach nicht", () => {
    expect(vehiclePositions([first], at("08:59:30"))[0]).toMatchObject({ lon: 7, atStop: true });
    expect(vehiclePositions([first], at("08:58:00"))).toEqual([]);
    expect(vehiclePositions([first, second], at("09:06:00"))).toEqual([]);
  });

  it("trennt Fahrzeuge nach Fahrt", () => {
    const other = segment({ trip: "t2", line: "709", mode: "tram" });
    expect(vehiclePositions([first, other], at("09:01:00")).map((v) => v.line)).toEqual([
      "U73",
      "709",
    ]);
  });
});
