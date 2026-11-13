import { describe, expect, it } from "vitest";
import { MODE_BADGE_CLASS, contrastTextColor, lineBadgeColors, parseHexColor } from "./line-colors";

describe("parseHexColor", () => {
  it("normalisiert gültige Farben", () => {
    expect(parseHexColor("008FC2")).toBe("#008fc2");
    expect(parseHexColor("#e3000f")).toBe("#e3000f");
  });

  it("verwirft ungültige Farben", () => {
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("fff")).toBeNull();
    expect(parseHexColor("red; background:url(x)")).toBeNull();
  });
});

describe("contrastTextColor", () => {
  it("wählt Weiß auf dunklem und Schwarz auf hellem Grund", () => {
    expect(contrastTextColor("#000000")).toBe("#ffffff");
    expect(contrastTextColor("#0a3d91")).toBe("#ffffff");
    expect(contrastTextColor("#ffffff")).toBe("#000000");
    expect(contrastTextColor("#ffd800")).toBe("#000000");
  });
});

describe("lineBadgeColors", () => {
  it("nutzt Linien- und Textfarbe aus der API", () => {
    expect(
      lineBadgeColors({ mode: "subway", lineColor: "008fc2", lineTextColor: "ffffff" }),
    ).toEqual({ style: { backgroundColor: "#008fc2", color: "#ffffff" } });
  });

  it("berechnet die Textfarbe, wenn sie fehlt", () => {
    expect(lineBadgeColors({ mode: "bus", lineColor: "ffd800", lineTextColor: null })).toEqual({
      style: { backgroundColor: "#ffd800", color: "#000000" },
    });
  });

  it("fällt ohne gültige Linienfarbe auf das Verkehrsmittel zurück", () => {
    expect(lineBadgeColors({ mode: "tram", lineColor: null, lineTextColor: "ffffff" })).toEqual({
      className: MODE_BADGE_CLASS.tram,
    });
    expect(lineBadgeColors({ mode: "bus", lineColor: "nope", lineTextColor: null })).toEqual({
      className: MODE_BADGE_CLASS.bus,
    });
  });
});
