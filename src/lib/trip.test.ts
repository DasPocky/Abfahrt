import { describe, expect, it } from "vitest";
import type { JourneyStop } from "../../shared/api-types";
import { stopIndex, tripProgress, tripStatus } from "@/lib/trip";

function stop(id: string, departure: string | null, arrival: string | null = null): JourneyStop {
  return {
    id,
    name: id,
    plannedArrival: arrival,
    realtimeArrival: null,
    plannedDeparture: departure,
    realtimeDeparture: null,
    platform: null,
    plannedPlatform: null,
    cancelled: false,
  };
}

const STOPS = [
  stop("vrr:de:05111:1", "2026-11-18T12:00:00Z"),
  stop("vrr:de:05111:2", "2026-11-18T12:03:00Z", "2026-11-18T12:02:00Z"),
  stop("vrr:de:05111:3", null, "2026-11-18T12:06:00Z"),
];

describe("tripProgress", () => {
  it("erkennt vor, während und nach der Fahrt", () => {
    expect(tripProgress(STOPS, new Date("2026-11-18T11:59:00Z"))).toEqual({ state: "before" });
    expect(tripProgress(STOPS, new Date("2026-11-18T12:01:00Z"))).toEqual({
      state: "between",
      index: 0,
    });
    expect(tripProgress(STOPS, new Date("2026-11-18T12:04:00Z"))).toEqual({
      state: "between",
      index: 1,
    });
    expect(tripProgress(STOPS, new Date("2026-11-18T12:07:00Z"))).toEqual({ state: "after" });
  });

  it("nimmt die Echtzeit vor dem Plan", () => {
    const late = [{ ...STOPS[0]!, realtimeDeparture: "2026-11-18T12:05:00Z" }, ...STOPS.slice(1)];
    expect(tripProgress(late, new Date("2026-11-18T12:01:00Z"))).toEqual({ state: "before" });
  });
});

describe("stopIndex", () => {
  it("findet die Haltestelle auch über Steig- und Transitous-IDs", () => {
    expect(stopIndex(STOPS, "vrr:de:05111:2")).toBe(1);
    expect(stopIndex(STOPS, "transitous:de-DELFI_de:05111:3:1:2")).toBe(2);
    expect(stopIndex(STOPS, "vrr:de:05111:99")).toBe(-1);
    expect(stopIndex(STOPS, null)).toBe(-1);
    // keine Teiltreffer: de:05111:1 ist nicht de:05111:18036
    expect(stopIndex(STOPS, "vrr:de:05111:18036")).toBe(-1);
  });
});

describe("tripStatus", () => {
  const now = new Date("2026-11-18T12:01:00Z");
  it("nennt die eigene Haltestelle, solange die Fahrt noch nicht dort war", () => {
    expect(tripStatus(STOPS, 2, now)).toBe("An vrr:de:05111:3 in 5 Min");
  });
  it("sonst den nächsten Halt bzw. die Abfahrt am Start", () => {
    expect(tripStatus(STOPS, 0, now)).toBe("Nächster Halt vrr:de:05111:2 in 2 Min");
    expect(tripStatus(STOPS, -1, new Date("2026-11-18T11:50:00Z"))).toBe(
      "Abfahrt ab vrr:de:05111:1 in 10 Min",
    );
    expect(tripStatus(STOPS, -1, new Date("2026-11-18T12:30:00Z"))).toBe("Fahrt beendet");
  });
});
