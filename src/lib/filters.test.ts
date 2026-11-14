import { describe, expect, it } from "vitest";
import { departure } from "../test-utils";
import {
  availableLines,
  availableModes,
  availablePlatforms,
  describeFilter,
  EMPTY_FILTER,
  filterDepartures,
  filterFromParams,
  filterKey,
  filterToParams,
  isEmptyFilter,
  toggle,
} from "./filters";

const DEPS = [
  departure({ id: "1", line: "S6", mode: "suburban", platform: "13" }),
  departure({ id: "2", line: "RE1", mode: "regional", platform: "16" }),
  departure({ id: "3", line: "U79", mode: "subway", platform: "2" }),
  departure({ id: "4", line: "U75", mode: "subway", platform: "1" }),
  departure({ id: "5", line: "721", mode: "bus", platform: null }),
  departure({ id: "6", line: "S1", mode: "suburban", platform: "11" }),
];

describe("filterDepartures", () => {
  it("lässt ohne Filter alles durch", () => {
    expect(filterDepartures(DEPS, EMPTY_FILTER)).toHaveLength(6);
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
  });

  it("filtert nach Verkehrsmitteln (mehrere möglich)", () => {
    const ids = filterDepartures(DEPS, { ...EMPTY_FILTER, modes: ["suburban", "regional"] }).map(
      (d) => d.id,
    );
    expect(ids).toEqual(["1", "2", "6"]);
  });

  it("filtert nach Linie und Gleis kombiniert", () => {
    expect(
      filterDepartures(DEPS, { ...EMPTY_FILTER, lines: ["U79", "U75"], platforms: ["2"] }).map(
        (d) => d.id,
      ),
    ).toEqual(["3"]);
    expect(filterDepartures(DEPS, { ...EMPTY_FILTER, platforms: ["99"] })).toEqual([]);
  });
});

describe("verfügbare Werte", () => {
  it("ordnet Verkehrsmittel nach Schiene vor Bus", () => {
    expect(availableModes(DEPS)).toEqual(["regional", "suburban", "subway", "bus"]);
  });

  it("sortiert Linien natürlich und beachtet gewählte Verkehrsmittel", () => {
    expect(availableLines(DEPS)).toEqual(["721", "RE1", "S1", "S6", "U75", "U79"]);
    expect(availableLines(DEPS, ["subway"])).toEqual(["U75", "U79"]);
    expect(availablePlatforms(DEPS)).toEqual(["1", "2", "11", "13", "16"]);
    expect(availablePlatforms(DEPS, ["suburban"])).toEqual(["11", "13"]);
  });
});

describe("URL-Format", () => {
  it("schreibt stabil sortiert und liest zurück", () => {
    const filter = {
      modes: ["subway" as const, "suburban" as const],
      lines: ["U79"],
      platforms: [],
      time: "2026-11-14T07:00:00.000Z",
    };
    const params = filterToParams(filter);
    expect(params.toString()).toBe(
      "vm=suburban%2Csubway&linie=U79&zeit=2026-11-14T07%3A00%3A00.000Z",
    );
    expect(filterFromParams(params)).toEqual({ ...filter, modes: ["suburban", "subway"] });
  });

  it("ignoriert Unsinn", () => {
    const f = filterFromParams(
      new URLSearchParams("vm=rakete,bus&zeit=gestern&gleis=" + "x".repeat(50)),
    );
    expect(f).toEqual({ modes: ["bus"], lines: [], platforms: [] });
  });

  it("Schlüssel ohne Zeitpunkt", () => {
    expect(filterKey({ ...EMPTY_FILTER, modes: ["bus"], time: "2026-11-14T07:00:00.000Z" })).toBe(
      "vm=bus",
    );
  });
});

describe("Hilfen", () => {
  it("beschreibt Filter lesbar", () => {
    expect(
      describeFilter({ modes: ["subway", "suburban"], lines: ["U79"], platforms: ["2"] }),
    ).toBe("S-Bahn, U-Bahn · U79 · Gleis 2");
    expect(toggle(["a"], "a")).toEqual([]);
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
  });
});
