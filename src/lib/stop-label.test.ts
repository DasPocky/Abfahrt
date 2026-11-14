import { describe, expect, it } from "vitest";
import { stopLabel } from "./stop-label";

describe("stopLabel", () => {
  it("hängt den Ort an, wenn er nicht im Namen steht", () => {
    expect(stopLabel({ name: "Hauptbahnhof", place: "Essen" })).toBe("Hauptbahnhof, Essen");
  });

  it("lässt Namen mit Ort und ohne Ort unverändert", () => {
    expect(stopLabel({ name: "Düsseldorf Hbf", place: "Düsseldorf" })).toBe("Düsseldorf Hbf");
    expect(stopLabel({ name: "Essen Hauptbahnhof" })).toBe("Essen Hauptbahnhof");
  });
});
