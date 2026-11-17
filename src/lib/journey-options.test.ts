import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  journeyOptionsFromParams,
  journeyOptionsKey,
  journeyOptionsToParams,
} from "../../shared/journey-options";

describe("neue VRR-Optionen (#101)", () => {
  it("überträgt Route, Barrierefreiheit einzeln, Fahrrad, Umgebung und Zwischenhalt", () => {
    const options = {
      ...DEFAULT_JOURNEY_OPTIONS,
      noStairs: true,
      lowFloor: true,
      route: "lessWalking" as const,
      bike: true,
      nearbyStops: true,
      via: "vrr:de:05111:18036",
      viaMinutes: 10,
    };
    const params = journeyOptionsToParams(options);
    expect(params.toString()).toBe(
      "noStairs=1&lowFloor=1&route=lessWalking&bike=1&nearby=1&via=vrr%3Ade%3A05111%3A18036&viaStay=10",
    );
    expect(journeyOptionsFromParams(params)).toEqual(options);
  });

  it.each(["route=bequem", "bike=ja", "via=xyz", "viaStay=5", "via=vrr:de:1&viaStay=999"])(
    "lehnt Ungültiges ab: %s",
    (raw) => {
      expect(journeyOptionsFromParams(new URLSearchParams(raw))).toBeNull();
    },
  );
});

describe("Verbindungsoptionen", () => {
  it("lässt Standardwerte weg", () => {
    expect(journeyOptionsToParams(DEFAULT_JOURNEY_OPTIONS).toString()).toBe("");
    expect(journeyOptionsKey(DEFAULT_JOURNEY_OPTIONS)).toBe("-");
  });

  it("überträgt alle Optionen hin und zurück, Verkehrsmittel in fester Reihenfolge", () => {
    const options = {
      ...DEFAULT_JOURNEY_OPTIONS,
      exclude: ["bus" as const, "longdistance" as const],
      maxTransfers: 0,
      transferSpeed: "slow" as const,
      accessible: true,
    };
    const params = journeyOptionsToParams(options);
    expect(params.toString()).toBe(
      "exclude=longdistance%2Cbus&maxTransfers=0&transfer=slow&accessible=1",
    );
    expect(journeyOptionsFromParams(params)).toEqual({
      ...options,
      exclude: ["longdistance", "bus"],
    });
  });

  it("lehnt ungültige Werte ab", () => {
    for (const q of [
      "exclude=auto",
      "maxTransfers=-1",
      "maxTransfers=6",
      "transfer=x",
      "accessible=2",
    ]) {
      expect(journeyOptionsFromParams(new URLSearchParams(q))).toBeNull();
    }
    const all = new URLSearchParams({ exclude: EXCLUDABLE_MODES.join(",") });
    expect(journeyOptionsFromParams(all)).toBeNull();
  });
});
