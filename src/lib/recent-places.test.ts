import { describe, expect, it } from "vitest";
import {
  addRecent,
  MAX_RECENT,
  parseRecent,
  recentToStop,
  removeRecent,
  serializeRecent,
  toRecent,
  type RecentPlace,
} from "@/lib/recent-places";

const HBF: RecentPlace = { id: "vrr:de:05111:18235", name: "Düsseldorf Hbf", kind: "stop" };
const KOE: RecentPlace = {
  id: "geo:51.22603,6.77840",
  name: "Königsallee 1",
  place: "Düsseldorf",
  kind: "address",
  lat: 51.22603,
  lon: 6.7784,
};

describe("recent-places", () => {
  it("liest, was es schreibt", () => {
    expect(parseRecent(serializeRecent([KOE, HBF]))).toEqual([KOE, HBF]);
  });

  it("ist robust gegen kaputte oder fremde Daten", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("{kaputt")).toEqual([]);
    expect(parseRecent(JSON.stringify({ version: 99, items: [HBF] }))).toEqual([]);
    expect(
      parseRecent(
        JSON.stringify({ version: 1, items: [{ id: 1 }, { id: "x", name: "" }, HBF, HBF] }),
      ),
    ).toEqual([HBF]);
  });

  it("stellt den neuesten Ort vorn hin, ohne Doppelte, höchstens MAX_RECENT", () => {
    expect(addRecent([HBF, KOE], HBF)).toEqual([HBF, KOE]);
    expect(addRecent([HBF], KOE)).toEqual([KOE, HBF]);
    const many = Array.from({ length: MAX_RECENT + 3 }, (_, i) => ({ ...HBF, id: `vrr:${i}` }));
    expect(many.reduce(addRecent, [] as RecentPlace[])).toHaveLength(MAX_RECENT);
    expect(removeRecent([HBF, KOE], HBF.id)).toEqual([KOE]);
  });

  it("wandelt Suchtreffer hin und zurück", () => {
    const stop = { id: HBF.id, name: HBF.name, relevance: 900 };
    expect(toRecent(stop)).toEqual(HBF);
    expect(recentToStop(HBF)).toEqual({ id: HBF.id, name: HBF.name });
    expect(recentToStop(KOE).kind).toBe("address");
  });
});
