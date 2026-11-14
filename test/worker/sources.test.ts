import { describe, expect, it } from "vitest";
import { applyLineColors, normalizeHex, normalizeLineName } from "../../worker/line-colors";
import * as transitous from "../../worker/sources/transitous";
import * as vrr from "../../worker/sources/vrr";
import transitousStopTimes from "./fixtures/transitous-stoptimes.json";
import transitousColors from "./fixtures/transitous-stoptimes-colors.json";
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

describe("Linienfarben", () => {
  it("normalisiert Linienbezeichnungen und Farben", () => {
    expect(normalizeLineName("RE 5 (RRX)")).toBe("RE5");
    expect(normalizeLineName("RE5 (28512)")).toBe("RE5");
    expect(normalizeLineName(" s 8 ")).toBe("S8");
    expect(normalizeLineName("U79")).toBe("U79");
    expect(normalizeHex("#009A93")).toBe("009a93");
    expect(normalizeHex("blau")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });

  it("gewinnt aus Transitous-Abfahrten (Heinrich-Heine-Allee) je U-Bahn-Linie eine eigene Farbe", () => {
    const colors = transitous.lineColorsFromStopTimes(transitousColors.stopTimes);
    const subway = ["U71", "U72", "U73", "U75", "U76", "U77", "U78", "U79", "U80", "U83"];
    for (const line of subway) expect(colors[line]?.color).toMatch(/^[0-9a-f]{6}$/);
    expect(new Set(subway.map((l) => colors[l]?.color)).size).toBe(subway.length);
    expect(colors.U79).toEqual({ color: "009a93", textColor: "ffffff" });
    expect(colors.U71).toEqual({ color: "59c6f2", textColor: "000000" });
  });

  it("übernimmt nur Einträge mit gültiger Farbe, der erste Treffer gilt", () => {
    const colors = transitous.lineColorsFromStopTimes([
      { displayName: "S1", routeShortName: "S1", mode: "BUS", place: {} },
      { displayName: "S1", routeShortName: "S1", routeColor: "0cb14b", place: {} },
      { displayName: "S1", routeShortName: "S1", routeColor: "ff0000", place: {} },
      { displayName: "RE5 (28512)", routeShortName: "RE5", routeColor: "FF6418", place: {} },
      { displayName: "X", routeColor: "kaputt", place: {} },
    ]);
    expect(colors).toEqual({
      S1: { color: "0cb14b", textColor: null },
      RE5: { color: "ff6418", textColor: null },
    });
  });

  it("ergänzt fehlende Farben in VRR-Abfahrten anhand der normalisierten Linie", () => {
    const deps = vrrDm.stopEvents.map(vrr.toDeparture).filter((d) => d !== null);
    const colors = transitous.lineColorsFromStopTimes(transitousColors.stopTimes);
    const colored = applyLineColors(deps, { ...colors, RE5: { color: "ff6418", textColor: null } });
    expect(colored.find((d) => d.line === "U79")).toMatchObject({
      lineColor: "009a93",
      lineTextColor: "ffffff",
    });
    expect(colored.every((d) => d.lineColor !== null)).toBe(true);
    // Originale bleiben unverändert, vorhandene Farben werden nicht überschrieben
    expect(deps.every((d) => d.lineColor === null)).toBe(true);
    const [first] = applyLineColors(
      [
        { ...deps[0]!, line: "RE 5 (RRX)" },
        { ...deps[0]!, lineColor: "123456" },
      ],
      { RE5: { color: "ff6418", textColor: null }, U73: { color: "000000", textColor: null } },
    );
    expect(first?.lineColor).toBe("ff6418");
    expect(applyLineColors([{ ...deps[0]!, lineColor: "123456" }], colors)[0]?.lineColor).toBe(
      "123456",
    );
  });

  it("fragt die Farben zur Mittagszeit des nächsten Werktags ab", () => {
    // Freitag 14:00 UTC → Montag 11:00 UTC
    expect(transitous.colorSampleTime(new Date("2026-11-13T14:00:00Z")).toISOString()).toBe(
      "2026-11-16T11:00:00.000Z",
    );
    // Dienstag 08:00 UTC → derselbe Tag 11:00 UTC
    expect(transitous.colorSampleTime(new Date("2026-11-17T08:00:00Z")).toISOString()).toBe(
      "2026-11-17T11:00:00.000Z",
    );
  });
});
