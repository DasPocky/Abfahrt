import { describe, expect, it } from "vitest";
import { departure } from "../test-utils";
import { summarizeNotices } from "./notices";

describe("summarizeNotices", () => {
  it("fasst Hinweise, die mehrere Fahrten betreffen, für die Haltestelle zusammen", () => {
    const { stopNotices, departureNotices } = summarizeNotices([
      departure({ id: "a", notices: ["Aufzug Gleis 3 defekt", "Umleitung wegen Demo"] }),
      departure({ id: "b", notices: ["Aufzug  Gleis 3 defekt ", "Kurzzug"] }),
      departure({ id: "c", notices: ["Umleitung wegen Demo", "aufzug gleis 3 defekt"] }),
      departure({ id: "d", notices: [] }),
    ]);
    // häufigster zuerst, Text in der ersten Schreibweise
    expect(stopNotices).toEqual(["Aufzug Gleis 3 defekt", "Umleitung wegen Demo"]);
    expect(departureNotices.get("a")).toEqual([]);
    expect(departureNotices.get("b")).toEqual(["Kurzzug"]);
    expect(departureNotices.get("c")).toEqual([]);
    expect(departureNotices.get("d")).toEqual([]);
  });

  it("lässt Einzelhinweise bei der Fahrt und zählt doppelte Hinweise einer Fahrt nur einmal", () => {
    const { stopNotices, departureNotices } = summarizeNotices([
      departure({ id: "a", notices: ["Kurzzug", "Kurzzug", "  "] }),
      departure({ id: "b", notices: ["Ersatzverkehr"] }),
    ]);
    expect(stopNotices).toEqual([]);
    expect(departureNotices.get("a")).toEqual(["Kurzzug"]);
    expect(departureNotices.get("b")).toEqual(["Ersatzverkehr"]);
  });

  it("kommt mit einer leeren Liste aus", () => {
    const { stopNotices, departureNotices } = summarizeNotices([]);
    expect(stopNotices).toEqual([]);
    expect(departureNotices.size).toBe(0);
  });
});
