import { beforeEach, describe, expect, it } from "vitest";
import {
  addFavorite,
  FAVORITES_KEY,
  getFavorites,
  moveFavorite,
  parseFavorites,
  removeFavorite,
  serializeFavorites,
  setFavorites,
  toFavorite,
} from "./favorites";

const A = { id: "vrr:a", name: "A" };
const B = { id: "vrr:b", name: "B", place: "Düsseldorf" };
const C = { id: "vrr:c", name: "C" };

beforeEach(() => localStorage.clear());

describe("parseFavorites", () => {
  it("liest gültige Daten", () => {
    expect(parseFavorites(serializeFavorites([A, B]))).toEqual([A, B]);
  });

  it("ignoriert kaputte, fremde oder unbekannte Versionen", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("{kaputt")).toEqual([]);
    expect(parseFavorites(JSON.stringify([A]))).toEqual([]);
    expect(parseFavorites(JSON.stringify({ version: 99, items: [A] }))).toEqual([]);
  });

  it("verwirft ungültige Einträge und Doppelte", () => {
    const raw = JSON.stringify({ version: 1, items: [A, { id: 1 }, A, B] });
    expect(parseFavorites(raw)).toEqual([A, B]);
  });
});

describe("Listenoperationen", () => {
  it("fügt ohne Doppelte hinzu und entfernt", () => {
    expect(addFavorite([A], A)).toEqual([A]);
    expect(addFavorite([A], B)).toEqual([A, B]);
    expect(removeFavorite([A, B], "vrr:a")).toEqual([B]);
  });

  it("verschiebt innerhalb der Grenzen", () => {
    expect(moveFavorite([A, B, C], "vrr:c", -1)).toEqual([A, C, B]);
    expect(moveFavorite([A, B, C], "vrr:a", -1)).toEqual([A, B, C]);
    expect(moveFavorite([A, B, C], "vrr:a", 2)).toEqual([B, C, A]);
  });

  it("übernimmt den Ort nur, wenn vorhanden", () => {
    expect(toFavorite({ id: "x", name: "X" })).toEqual({ id: "x", name: "X" });
    expect(toFavorite({ id: "x", name: "X", place: "Köln" })).toEqual({
      id: "x",
      name: "X",
      place: "Köln",
    });
  });
});

describe("Speicher", () => {
  it("speichert versioniert unter dem App-Präfix", () => {
    setFavorites([A]);
    expect(localStorage.getItem(FAVORITES_KEY)).toBe(JSON.stringify({ version: 1, items: [A] }));
    expect(FAVORITES_KEY.startsWith("abfahrt:")).toBe(true);
    expect(getFavorites()).toEqual([A]);
  });
});
