import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOURNEY_OPTIONS,
  EXCLUDABLE_MODES,
  journeyOptionsFromParams,
  journeyOptionsKey,
  journeyOptionsToParams,
} from "../../shared/journey-options";

describe("Verbindungsoptionen", () => {
  it("lässt Standardwerte weg", () => {
    expect(journeyOptionsToParams(DEFAULT_JOURNEY_OPTIONS).toString()).toBe("");
    expect(journeyOptionsKey(DEFAULT_JOURNEY_OPTIONS)).toBe("-");
  });

  it("überträgt alle Optionen hin und zurück, Verkehrsmittel in fester Reihenfolge", () => {
    const options = {
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
