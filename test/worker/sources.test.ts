import { describe, expect, it } from "vitest";
import * as transitous from "../../worker/sources/transitous";
import * as vrr from "../../worker/sources/vrr";
import transitousStopTimes from "./fixtures/transitous-stoptimes.json";
import vrrDm from "./fixtures/vrr-dm.json";
import vrrDmHbf from "./fixtures/vrr-dm-hbf.json";

describe("VRR-Adapter", () => {
  it("erkennt das VRR-Gebiet am Kreisschlüssel", () => {
    expect(vrr.isVrrArea("de:05111:18036")).toBe(true); // Düsseldorf
    expect(vrr.isVrrArea("de:05913:1234")).toBe(true); // Dortmund
    expect(vrr.isVrrArea("de:05315:11201")).toBe(false); // Köln (VRS)
    expect(vrr.isVrrArea("de:11000:900003201")).toBe(false); // Berlin
  });

  it("normalisiert Stadtbahn-Abfahrten mit Echtzeit, Gleis und Hinweisen", () => {
    const deps = vrrDm.stopEvents.map(vrr.toDeparture).filter((d) => d !== null);
    expect(deps.length).toBe(vrrDm.stopEvents.length);
    const first = deps[0]!;
    expect(first).toMatchObject({ line: "U73", mode: "subway", platform: "6", cancelled: false });
    expect(first.realtimeTime).not.toBeNull();
    expect(deps.some((d) => d.notices.length > 0)).toBe(true);
  });

  it("ordnet Produktklassen Verkehrsmitteln zu", () => {
    const modes = new Set(
      vrrDmHbf.stopEvents.map((e, i) => vrr.toDeparture(e, i)?.mode).filter(Boolean),
    );
    expect(modes).toContain("regional");
    expect(modes).toContain("suburban");
    expect(modes).toContain("bus");
    expect(modes).toContain("tram");
    expect(modes).not.toContain("other");
  });

  it("erkennt Ausfälle und Gleiswechsel", () => {
    const dep = vrr.toDeparture(
      {
        isRealtimeControlled: true,
        realtimeStatus: ["TRIP_CANCELLED"],
        departureTimePlanned: "2026-11-13T16:00:00Z",
        location: { properties: { platformName: "5", plannedPlatformName: "4" } },
        transportation: {
          disassembledName: "RE1",
          product: { class: 13 },
          destination: { name: "Aachen" },
        },
      },
      0,
    );
    expect(dep).toMatchObject({
      cancelled: true,
      platform: "5",
      plannedPlatform: "4",
      mode: "regional",
    });
  });
});

describe("Transitous-Adapter", () => {
  it("normalisiert Abfahrten", () => {
    const deps = transitousStopTimes.stopTimes
      .map(transitous.toDeparture)
      .filter((d) => d !== null);
    expect(deps.length).toBe(transitousStopTimes.stopTimes.length);
    expect(new Set(deps.map((d) => d.mode))).toContain("suburban");
    expect(deps.every((d) => d.notices.length === 0)).toBe(true);
    expect(deps.some((d) => d.realtimeTime !== null)).toBe(true);
  });
});
