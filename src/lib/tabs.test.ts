import { describe, expect, it } from "vitest";
import { remember, TABS, tabForPath, tabTarget } from "./tabs";

const tab = (key: string) => TABS.find((t) => t.key === key)!;

describe("Navigation unten (#106)", () => {
  it("ordnet Seiten ihrem Bereich zu", () => {
    expect(tabForPath("/")).toBe("abfahrten");
    expect(tabForPath("/haltestelle/vrr%3Ade%3A05111%3A18036")).toBe("abfahrten");
    expect(tabForPath("/verbindung")).toBe("verbindung");
    expect(tabForPath("/fahrt")).toBe("verbindung");
    expect(tabForPath("/karte")).toBe("karte");
    expect(tabForPath("/stoerungen")).toBe("stoerungen");
    expect(tabForPath("/ueber")).toBe("mehr");
    expect(tabForPath("/gibtsnicht")).toBeNull();
  });

  it("merkt sich je Bereich die letzte Seite", () => {
    let memory = remember({}, "/haltestelle/x", "?vm=bus");
    memory = remember(memory, "/verbindung", "?von=a&nach=b");
    memory = remember(memory, "/gibtsnicht", "");
    expect(memory).toEqual({
      abfahrten: "/haltestelle/x?vm=bus",
      verbindung: "/verbindung?von=a&nach=b",
    });
  });

  it("führt in den zuletzt besuchten Stand, im aktiven Bereich an den Anfang", () => {
    const memory = { abfahrten: "/haltestelle/x", verbindung: "/fahrt" };
    expect(tabTarget(tab("abfahrten"), "karte", memory)).toBe("/haltestelle/x");
    expect(tabTarget(tab("abfahrten"), "abfahrten", memory)).toBe("/");
    expect(tabTarget(tab("karte"), "abfahrten", memory)).toBe("/karte");
  });
});
