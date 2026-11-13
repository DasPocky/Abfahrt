import { describe, expect, it } from "vitest";
import {
  delayMinutes,
  delayTone,
  formatClock,
  formatClockWithSeconds,
  formatCountdown,
  formatDelay,
  minutesUntil,
} from "./time";

const NOW = new Date("2026-11-13T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe("formatClock", () => {
  it("zeigt die Uhrzeit in Europe/Berlin (Winterzeit)", () => {
    expect(formatClock(at("2026-11-13T12:05:00Z"))).toBe("13:05");
  });

  it("zeigt die Uhrzeit in Europe/Berlin (Sommerzeit)", () => {
    expect(formatClock(at("2026-07-01T22:30:00Z"))).toBe("00:30");
  });

  it("zeigt auf Wunsch Sekunden", () => {
    expect(formatClockWithSeconds(at("2026-11-13T12:05:09Z"))).toBe("13:05:09");
  });
});

describe("minutesUntil", () => {
  it("rundet angebrochene Minuten ab", () => {
    expect(minutesUntil(at("2026-11-13T12:02:59Z"), NOW)).toBe(2);
    expect(minutesUntil(at("2026-11-13T11:59:30Z"), NOW)).toBe(-1);
  });
});

describe("formatCountdown", () => {
  it.each([
    ["2026-11-13T11:59:30Z", "jetzt"],
    ["2026-11-13T12:00:00Z", "jetzt"],
    ["2026-11-13T12:00:59Z", "jetzt"],
    ["2026-11-13T12:01:00Z", "in 1 Min"],
    ["2026-11-13T12:03:20Z", "in 3 Min"],
    ["2026-11-13T12:59:59Z", "in 59 Min"],
    ["2026-11-13T13:00:00Z", "14:00"],
    ["2026-11-13T15:42:00Z", "16:42"],
  ])("%s → %s", (iso, expected) => {
    expect(formatCountdown(at(iso), NOW)).toBe(expected);
  });
});

describe("delayMinutes", () => {
  it("ist null ohne Echtzeit", () => {
    expect(delayMinutes("2026-11-13T12:00:00Z", null)).toBeNull();
  });

  it("rechnet die Differenz in ganzen Minuten", () => {
    expect(delayMinutes("2026-11-13T12:00:00Z", "2026-11-13T12:00:00Z")).toBe(0);
    expect(delayMinutes("2026-11-13T12:00:00Z", "2026-11-13T12:02:00Z")).toBe(2);
    expect(delayMinutes("2026-11-13T12:00:00Z", "2026-11-13T11:59:00Z")).toBe(-1);
    expect(delayMinutes("2026-11-13T12:00:00Z", "2026-11-13T12:01:40Z")).toBe(2);
  });

  it("verträgt Zeitzonen-Offsets", () => {
    expect(delayMinutes("2026-11-13T13:00:00+01:00", "2026-11-13T12:05:00Z")).toBe(5);
  });

  it("ist null bei ungültigen Zeiten", () => {
    expect(delayMinutes("kaputt", "2026-11-13T12:00:00Z")).toBeNull();
  });
});

describe("delayTone", () => {
  it.each([
    [null, "unknown"],
    [-2, "success"],
    [0, "success"],
    [1, "warning"],
    [2, "warning"],
    [4, "warning"],
    [5, "destructive"],
    [20, "destructive"],
  ] as const)("%s → %s", (delay, tone) => {
    expect(delayTone(delay)).toBe(tone);
  });
});

describe("formatDelay", () => {
  it("formatiert mit Vorzeichen", () => {
    expect(formatDelay(null)).toBe("");
    expect(formatDelay(0)).toBe("+0");
    expect(formatDelay(2)).toBe("+2");
    expect(formatDelay(-1)).toBe("-1");
  });
});
