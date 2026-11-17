import { describe, expect, it } from "vitest";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import {
  formatTransfer,
  journeyTransferRisk,
  journeyTransfers,
  transferStatus,
  type Transfer,
} from "./connections";
import type { JourneyLeg } from "../../shared/api-types";

const T = (hhmm: string) => `2026-11-13T${hhmm}:00Z`;

/** Fahrt mit Abfahrt/Ankunft (Plan, optional Echtzeit) */
function ride(
  dep: string,
  arr: string,
  rt: { dep?: string | null; arr?: string | null } = {},
  extra: Partial<JourneyLeg> = {},
): JourneyLeg {
  return journeyLeg({
    origin: journeyStop({
      name: "A",
      plannedDeparture: T(dep),
      realtimeDeparture: rt.dep === undefined ? T(dep) : rt.dep && T(rt.dep),
    }),
    destination: journeyStop({
      name: "B",
      plannedArrival: T(arr),
      realtimeArrival: rt.arr === undefined ? T(arr) : rt.arr && T(rt.arr),
    }),
    ...extra,
  });
}

function walk(minutes: number): JourneyLeg {
  return journeyLeg({
    kind: "walk",
    line: null,
    mode: null,
    direction: null,
    durationMinutes: minutes,
    distanceMeters: 300,
  });
}

describe("transferStatus", () => {
  it("bewertet den Puffer", () => {
    expect(transferStatus(null)).toBe("unknown");
    expect(transferStatus(-1)).toBe("missed");
    expect(transferStatus(0)).toBe("tight");
    expect(transferStatus(1)).toBe("tight");
    expect(transferStatus(2)).toBe("ok");
    expect(transferStatus(15)).toBe("ok");
  });
});

/** Halt eines Abschnitts an einen Steig von Schlüterstraße setzen */
const atPlatform = (leg: JourneyLeg, side: "origin" | "destination", platform: string | null) => ({
  ...leg,
  [side]: { ...leg[side], id: "vrr:de:05111:18231", platform },
});

describe("journeyTransfers", () => {
  it("hat bei nur einem Abschnitt keine Umstiege", () => {
    expect(journeyTransfers(journey({ id: "j", legs: [ride("12:00", "12:10")] }))).toEqual([]);
    expect(journeyTransferRisk(journey({ id: "j", legs: [ride("12:00", "12:10")] }))).toBeNull();
  });

  it("rechnet mit Echtzeit, wenn vorhanden", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10", { arr: "12:14" }), ride("12:15", "12:30", { dep: "12:16" })],
    });
    expect(journeyTransfers(j)).toEqual([
      { fromLeg: 0, toLeg: 1, walkMinutes: 0, minutes: 2, status: "ok", samePlatform: false },
    ]);
  });

  it("nimmt ohne Echtzeit den Plan", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10", { arr: null }), ride("12:11", "12:30", { dep: null })],
    });
    expect(journeyTransfers(j)[0]).toMatchObject({ minutes: 1, status: "tight" });
    expect(journeyTransferRisk(j)).toBe("tight");
  });

  it("zieht Fußwege zwischen den Fahrten ab", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10"), walk(3), walk(2), ride("12:14", "12:30")],
    });
    expect(journeyTransfers(j)).toEqual([
      { fromLeg: 0, toLeg: 3, walkMinutes: 5, minutes: -1, status: "missed", samePlatform: false },
    ]);
    expect(journeyTransferRisk(j)).toBe("missed");
  });

  it("zählt Fußwege am Anfang und Ende nicht als Umstieg", () => {
    const j = journey({
      id: "j",
      legs: [walk(5), ride("12:00", "12:10"), ride("12:15", "12:30"), walk(8)],
    });
    expect(journeyTransfers(j)).toEqual([
      { fromLeg: 1, toLeg: 2, walkMinutes: 0, minutes: 5, status: "ok", samePlatform: false },
    ]);
  });

  it("erkennt Umstiege am selben Steig (#97)", () => {
    const arrive = ride("12:00", "12:10");
    const leave = ride("12:13", "12:30");
    const same = journey({
      id: "j",
      legs: [atPlatform(arrive, "destination", "1"), atPlatform(leave, "origin", "1")],
    });
    expect(journeyTransfers(same)[0]?.samePlatform).toBe(true);
    const other = journey({
      id: "j",
      legs: [atPlatform(arrive, "destination", "6"), atPlatform(leave, "origin", "4")],
    });
    expect(journeyTransfers(other)[0]?.samePlatform).toBe(false);
    // Fußweg dazwischen: nie „selber Steig“
    const walked = journey({
      id: "j",
      legs: [atPlatform(arrive, "destination", "1"), walk(1), atPlatform(leave, "origin", "1")],
    });
    expect(journeyTransfers(walked)[0]?.samePlatform).toBe(false);
  });

  it("bewertet Verspätung, die den Anschluss kostet", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10", { arr: "12:17" }), ride("12:15", "12:30")],
    });
    expect(journeyTransfers(j)[0]).toMatchObject({ minutes: -2, status: "missed" });
  });

  it("lässt fehlende Zeiten offen", () => {
    const leg = ride("12:00", "12:10");
    const noArrival = {
      ...leg,
      destination: { ...leg.destination, plannedArrival: null, realtimeArrival: null },
    };
    const j = journey({ id: "j", legs: [noArrival, ride("12:15", "12:30")] });
    expect(journeyTransfers(j)[0]).toMatchObject({ minutes: null, status: "unknown" });
    expect(journeyTransferRisk(j)).toBeNull();
  });

  it("bewertet keinen Anschluss, wenn eine Fahrt ausfällt", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10", {}, { cancelled: true }), ride("12:10", "12:30")],
    });
    expect(journeyTransfers(j)[0]).toMatchObject({ minutes: 0, status: "unknown" });
    expect(journeyTransferRisk(j)).toBeNull();
  });

  it("meldet den schlechtesten von mehreren Anschlüssen", () => {
    const j = journey({
      id: "j",
      legs: [ride("12:00", "12:10"), ride("12:11", "12:20"), ride("12:19", "12:40")],
    });
    expect(journeyTransfers(j).map((t) => t.status)).toEqual(["tight", "missed"]);
    expect(journeyTransferRisk(j)).toBe("missed");
  });
});

describe("formatTransfer", () => {
  const base: Transfer = {
    fromLeg: 0,
    toLeg: 1,
    walkMinutes: 0,
    minutes: 5,
    status: "ok",
    samePlatform: false,
  };
  it("formatiert je nach Status", () => {
    expect(formatTransfer(base)).toBe("5 Min Umstieg");
    expect(formatTransfer({ ...base, samePlatform: true })).toBe("5 Min Umstieg · selber Steig");
    expect(formatTransfer({ ...base, minutes: 1, status: "tight" })).toBe(
      "Anschluss gefährdet · 1 Min Umstieg",
    );
    expect(formatTransfer({ ...base, minutes: -3, status: "missed" })).toBe(
      "Anschluss nicht erreichbar · 3 Min zu knapp",
    );
    expect(formatTransfer({ ...base, minutes: null, status: "unknown" })).toBeNull();
    expect(formatTransfer({ ...base, status: "unknown" })).toBeNull();
  });
});
