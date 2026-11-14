import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_FILTER } from "./filters";
import {
  addFavorite,
  FAVORITES_KEY,
  favoriteKey,
  getFavorites,
  moveFavorite,
  parseFavorites,
  removeFavorite,
  renameFavorite,
  serializeFavorites,
  setFavorites,
  toFavorite,
} from "./favorites";

const HBF = { id: "vrr:de:05111:18235", name: "Düsseldorf Hbf", place: "Düsseldorf" };
const A = toFavorite(HBF);
const A_SBAHN = toFavorite(HBF, { ...EMPTY_FILTER, modes: ["suburban"] });
const B = toFavorite({ id: "vrr:b", name: "B" });

beforeEach(() => localStorage.clear());

describe("Format v2", () => {
  it("speichert und liest Haltestelle mit Filter", () => {
    const back = parseFavorites(serializeFavorites([A, A_SBAHN]));
    expect(back).toEqual([A, A_SBAHN]);
    expect(back[1]?.filter.modes).toEqual(["suburban"]);
  });

  it("erlaubt dieselbe Haltestelle mehrfach mit verschiedenen Filtern", () => {
    expect(A.key).not.toBe(A_SBAHN.key);
    expect(addFavorite([A], A_SBAHN)).toHaveLength(2);
    expect(addFavorite([A], toFavorite(HBF))).toHaveLength(1);
  });

  it("speichert keinen Zeitpunkt im Favoriten", () => {
    const f = toFavorite(HBF, {
      ...EMPTY_FILTER,
      modes: ["bus"],
      time: "2026-11-14T07:00:00.000Z",
    });
    expect(f.filter.time).toBeUndefined();
    expect(f.key).toBe(favoriteKey(HBF.id, { ...EMPTY_FILTER, modes: ["bus"] }));
  });
});

describe("Migration", () => {
  it("übernimmt Favoriten aus Version 1", () => {
    const v1 = JSON.stringify({
      version: 1,
      items: [{ id: HBF.id, name: HBF.name, place: HBF.place }],
    });
    expect(parseFavorites(v1)).toEqual([A]);
  });

  it("ignoriert kaputte, fremde oder unbekannte Daten", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("{kaputt")).toEqual([]);
    expect(parseFavorites(JSON.stringify([A]))).toEqual([]);
    expect(parseFavorites(JSON.stringify({ version: 99, items: [] }))).toEqual([]);
    expect(parseFavorites(JSON.stringify({ version: 2, items: [{ stopId: 1 }, A] }))).toEqual([]);
  });
});

describe("Listenoperationen", () => {
  it("entfernt, verschiebt und benennt um", () => {
    expect(removeFavorite([A, B], A.key)).toEqual([B]);
    expect(moveFavorite([A, B], B.key, -1)).toEqual([B, A]);
    expect(moveFavorite([A, B], A.key, -1)).toEqual([A, B]);
    expect(renameFavorite([A], A.key, "  Arbeit  ")[0]?.label).toBe("Arbeit");
    expect(renameFavorite([A], A.key, "")[0]?.label).toBeUndefined();
  });
});

describe("Speicher", () => {
  it("speichert versioniert unter dem App-Präfix", () => {
    setFavorites([A_SBAHN]);
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "{}");
    expect(stored).toEqual({
      version: 2,
      items: [{ stopId: HBF.id, name: HBF.name, place: HBF.place, filter: "vm=suburban" }],
    });
    expect(getFavorites()).toEqual([A_SBAHN]);
  });
});
