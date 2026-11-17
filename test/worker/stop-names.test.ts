import { describe, expect, it } from "vitest";
import { directionAt, sameCity, splitCityPrefix, stripCityPrefix } from "../../worker/stop-names";

describe("Orte in Namen (#94)", () => {
  it("löst bekannte Städtekürzel auf", () => {
    expect(splitCityPrefix("D-Holthausen")).toEqual({ name: "Holthausen", city: "Düsseldorf" });
    expect(splitCityPrefix("DU-Meiderich Süd Bf")).toEqual({
      name: "Meiderich Süd Bf",
      city: "Duisburg",
    });
    expect(splitCityPrefix("BOT-ZOB")).toEqual({ name: "ZOB", city: "Bottrop" });
  });

  it.each(["S-Bahnhof Kalk", "Bad Neuenahr-Ahrweiler", "XY-Unbekannt", "Duisburg Uni Nord"])(
    "lässt anderes unverändert: %s",
    (raw) => {
      expect(splitCityPrefix(raw)).toEqual({ name: raw, city: null });
      expect(stripCityPrefix(raw)).toBe(raw);
    },
  );

  it("vergleicht Städte auch mit Zusätzen", () => {
    expect(sameCity("Mülheim a.d. Ruhr", "Mülheim")).toBe(true);
    expect(sameCity("Oberhausen (Rheinl)", "Oberhausen")).toBe(true);
    expect(sameCity("Düsseldorf", "Duisburg")).toBe(false);
    expect(sameCity(null, "Düsseldorf")).toBe(false);
  });

  it("schreibt das Ziel nur in anderen Städten mit Ort", () => {
    expect(directionAt("D-Benrath Btf", "Düsseldorf")).toBe("Benrath Btf");
    expect(directionAt("D-Holthausen", "Krefeld")).toBe("Düsseldorf Holthausen");
    expect(directionAt("D-Holthausen", undefined)).toBe("Düsseldorf Holthausen");
    expect(directionAt("Neuss Hauptbahnhof", "Düsseldorf")).toBe("Neuss Hauptbahnhof");
  });
});
