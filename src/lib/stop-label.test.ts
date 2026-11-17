import { describe, expect, it } from "vitest";
import { otherPlace, stopLabel } from "./stop-label";

describe("stopLabel", () => {
  it("hängt den Ort an, wenn er nicht im Namen steht", () => {
    expect(stopLabel({ name: "Hauptbahnhof", place: "Essen" })).toBe("Hauptbahnhof, Essen");
  });

  it("lässt Namen mit Ort und ohne Ort unverändert", () => {
    expect(stopLabel({ name: "Düsseldorf Hbf", place: "Düsseldorf" })).toBe("Düsseldorf Hbf");
    expect(stopLabel({ name: "Essen Hauptbahnhof" })).toBe("Essen Hauptbahnhof");
  });
});

describe("otherPlace (#94)", () => {
  it("zeigt den Ort nur außerhalb der Startstadt", () => {
    expect(otherPlace("Düsseldorf", "Dortmund")).toBe("Düsseldorf");
    expect(otherPlace("Düsseldorf", "Düsseldorf")).toBeNull();
    expect(otherPlace("Mülheim a.d. Ruhr", "Mülheim")).toBeNull();
    expect(otherPlace("Düsseldorf", undefined)).toBe("Düsseldorf");
    expect(otherPlace(undefined, "Dortmund")).toBeNull();
  });
});
