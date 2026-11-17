import { describe, expect, it } from "vitest";
import {
  clockValue,
  dateValue,
  dayChoices,
  dayOffset,
  quickLabel,
  shiftMinutes,
  withClock,
  withDate,
  withDay,
} from "./journey-time";

// Lokale Zeit des Testrechners: Werte über lokale Konstruktoren bauen
const now = new Date(2026, 10, 17, 12, 4, 30); // Di 17.11.2026, 12:04:30
const local = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString();

describe("Zeitpunkt der Verbindungssuche (#102)", () => {
  it("wechselt den Tag und behält die Uhrzeit", () => {
    expect(withDay(local(17, 8, 30), 1, now)).toBe(local(18, 8, 30));
    // ohne Zeitpunkt: aktuelle Uhrzeit (volle Minute) am gewählten Tag
    expect(withDay(undefined, 2, now)).toBe(local(19, 12, 4));
    expect(dayOffset(local(19, 8, 0), now)).toBe(2);
    expect(dayOffset(undefined, now)).toBe(0);
  });

  it("setzt Uhrzeit und Datum aus den Eingabefeldern", () => {
    expect(withClock(local(18, 8, 30), "17:45", now)).toBe(local(18, 17, 45));
    expect(withClock(undefined, "06:05", now)).toBe(local(17, 6, 5));
    expect(withClock(local(18, 8, 30), "", now)).toBe(local(18, 8, 30));
    expect(withDate(local(17, 8, 30), "2026-11-21", now)).toBe(local(21, 8, 30));
    expect(clockValue(local(18, 8, 5), now)).toBe("08:05");
    expect(dateValue(undefined, now)).toBe("2026-11-17");
  });

  it("verschiebt um Minuten, ohne Zeitpunkt ab jetzt", () => {
    expect(shiftMinutes(local(17, 23, 50), 15, now)).toBe(local(18, 0, 5));
    expect(shiftMinutes(undefined, 30, now)).toBe(local(17, 12, 34));
    expect(shiftMinutes(local(17, 8, 0), -15, now)).toBe(local(17, 7, 45));
  });

  it("bietet Heute, Morgen und Wochentage an", () => {
    expect(dayChoices(now).map((d) => d.label)).toEqual([
      "Heute",
      "Morgen",
      "Do 19.",
      "Fr 20.",
      "Sa 21.",
    ]);
    expect(quickLabel(15)).toBe("in 15 Min");
    expect(quickLabel(60)).toBe("in 1 Std");
  });
});
