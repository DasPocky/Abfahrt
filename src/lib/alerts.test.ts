import { describe, expect, it } from "vitest";
import { alert } from "../test-utils";
import { EMPTY_FILTER } from "@/lib/filters";
import {
  affectsFavorite,
  alertModes,
  duplicatesNotice,
  favoriteAlerts,
  favoriteAlertStops,
  filterAlertsByLines,
  filterAlertsByModes,
  formatValidity,
  normalizeLine,
  sameStop,
  sortAlerts,
  truncateText,
} from "./alerts";

const NOW = new Date("2026-11-16T12:00:00Z");

describe("sortAlerts", () => {
  it("ordnet Sperrung vor Aufzug vor Info, dann nach Schwere und neuerem Beginn", () => {
    const sorted = sortAlerts([
      alert({ id: "info", kind: "info", severity: "high" }),
      alert({ id: "lift", kind: "facility" }),
      alert({ id: "old", validFrom: "2026-09-01T00:00:00Z" }),
      alert({ id: "open", validFrom: null }),
      alert({ id: "new", validFrom: "2026-11-01T00:00:00Z" }),
      alert({ id: "high", severity: "high", validFrom: null }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["high", "new", "old", "open", "lift", "info"]);
  });
});

describe("Linien und Verkehrsmittel", () => {
  const tram = alert({ id: "tram" });
  const re = alert({ id: "re", lines: [{ line: "RE 1", mode: "regional" }] });
  const lift = alert({ id: "lift", kind: "facility", lines: [] });

  it("vergleicht Linien ohne Leerzeichen und Großschreibung", () => {
    expect(normalizeLine(" re 1 ")).toBe("RE1");
    expect(filterAlertsByLines([tram, re, lift], ["RE1"]).map((a) => a.id)).toEqual(["re"]);
    expect(filterAlertsByLines([tram, re], [])).toHaveLength(2);
  });

  it("filtert nach Verkehrsmittel und listet die vorhandenen in fester Reihenfolge", () => {
    expect(alertModes([tram, re, lift])).toEqual(["regional", "tram"]);
    expect(filterAlertsByModes([tram, re, lift], ["tram"]).map((a) => a.id)).toEqual(["tram"]);
    expect(filterAlertsByModes([tram, re, lift], [])).toHaveLength(3);
  });
});

describe("Bezug zu Favoriten", () => {
  const flingern = { stopId: "vrr:de:05111:18560", filter: EMPTY_FILTER };
  const hbfRe = {
    stopId: "vrr:de:05111:18235",
    filter: { ...EMPTY_FILTER, lines: ["RE1"] },
  };

  it("erkennt Haltestelle (auch Steig) oder eine Linie des Filters", () => {
    expect(sameStop("vrr:de:05111:18560:1:3", "vrr:de:05111:18560")).toBe(true);
    expect(sameStop("vrr:de:05111:1856", "vrr:de:05111:18560")).toBe(false);
    expect(affectsFavorite(alert({ id: "a" }), flingern)).toBe(true);
    expect(affectsFavorite(alert({ id: "b", stops: [] }), flingern)).toBe(false);
    const re = alert({ id: "c", stops: [], lines: [{ line: "RE 1", mode: "regional" }] });
    expect(affectsFavorite(re, hbfRe)).toBe(true);
    expect(affectsFavorite(re, { ...hbfRe, filter: EMPTY_FILTER })).toBe(false);
  });

  it("liefert jede Meldung einmal", () => {
    const a = alert({ id: "a" });
    expect(favoriteAlerts([a, a, alert({ id: "x", stops: [] })], [flingern])).toEqual([a]);
  });

  it("fragt nur VRR-Haltestellen ab, je einmal mit allen Linien, höchstens max", () => {
    expect(
      favoriteAlertStops(
        [
          hbfRe,
          { ...hbfRe, filter: { ...EMPTY_FILTER, lines: ["S6", "RE1"] } },
          { stopId: "transitous:abc", filter: EMPTY_FILTER },
          flingern,
          { stopId: "vrr:de:05111:1", filter: EMPTY_FILTER },
        ],
        2,
      ),
    ).toEqual([
      { stopId: "vrr:de:05111:18235", lines: ["RE1", "S6"] },
      { stopId: "vrr:de:05111:18560", lines: [] },
    ]);
  });
});

describe("truncateText", () => {
  it("kürzt an einer Wortgrenze", () => {
    expect(truncateText("kurz", 10)).toBe("kurz");
    expect(truncateText("Aufzug am Gleis 3 außer Betrieb", 20)).toBe("Aufzug am Gleis 3…");
    expect(truncateText("Donaudampfschifffahrt", 10)).toBe("Donaudamp…");
  });
});

describe("formatValidity", () => {
  it("zeigt bis, seit und ab in Europe/Berlin", () => {
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(formatValidity({ validFrom: null, validTo: "2026-11-20T23:30:00Z" }, NOW)).toBe(
      "bis 21.11.",
    );
    expect(formatValidity({ validFrom: "2026-10-10T06:00:00Z", validTo: null }, NOW)).toBe(
      "seit 10.10.",
    );
    expect(
      formatValidity({ validFrom: "2026-11-30T06:00:00Z", validTo: "2026-12-05T00:00:00Z" }, NOW),
    ).toBe("ab 30.11.");
    expect(formatValidity({ validFrom: null, validTo: "2027-01-05T12:00:00Z" }, NOW)).toBe(
      "bis 05.01.2027",
    );
  });

  it("behandelt Platzhalter weit in der Zukunft als offenes Ende", () => {
    expect(
      formatValidity({ validFrom: "2026-10-10T06:00:00Z", validTo: "2099-12-31T00:00:00Z" }, NOW),
    ).toBe("seit 10.10.");
    expect(formatValidity({ validFrom: null, validTo: null }, NOW)).toBe("");
  });
});

describe("duplicatesNotice", () => {
  const lift = alert({
    id: "lift",
    kind: "facility",
    title: "Haltestelle Essen Hauptbahnhof: Aufzug außer Betrieb.",
    text: "",
  });

  it("erkennt gleichen Titel oder Text, auch als Teil eines Hinweises", () => {
    expect(duplicatesNotice(lift, ["haltestelle essen hauptbahnhof:  aufzug außer betrieb"])).toBe(
      true,
    );
    expect(
      duplicatesNotice(lift, ["Haltestelle Essen Hauptbahnhof: Aufzug außer Betrieb. Bitte …"]),
    ).toBe(true);
    expect(duplicatesNotice(alert({ id: "t" }), [alert({ id: "t" }).text])).toBe(true);
    expect(duplicatesNotice(lift, ["Kurzzug", ""])).toBe(false);
  });
});
