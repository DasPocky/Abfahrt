import { describe, expect, it } from "vitest";
import { departure } from "../test-utils";
import { effectiveTime, hasPlatformChange, sortDepartures, upcomingDepartures } from "./departures";

describe("effectiveTime", () => {
  it("nimmt die Echtzeit, sonst den Plan", () => {
    expect(
      effectiveTime(
        departure({
          id: "a",
          plannedTime: "2026-11-13T12:00:00Z",
          realtimeTime: "2026-11-13T12:04:00Z",
        }),
      ).toISOString(),
    ).toBe("2026-11-13T12:04:00.000Z");
    expect(
      effectiveTime(
        departure({ id: "b", plannedTime: "2026-11-13T12:00:00Z", realtimeTime: null }),
      ).toISOString(),
    ).toBe("2026-11-13T12:00:00.000Z");
  });
});

describe("sortDepartures", () => {
  it("sortiert nach tatsächlicher Abfahrtszeit", () => {
    const late = departure({
      id: "late",
      plannedTime: "2026-11-13T12:00:00Z",
      realtimeTime: "2026-11-13T12:10:00Z",
    });
    const onTime = departure({
      id: "onTime",
      plannedTime: "2026-11-13T12:05:00Z",
      realtimeTime: "2026-11-13T12:05:00Z",
    });
    const noRealtime = departure({
      id: "noRealtime",
      plannedTime: "2026-11-13T12:07:00Z",
      realtimeTime: null,
    });
    const input = [late, noRealtime, onTime];
    expect(sortDepartures(input).map((d) => d.id)).toEqual(["onTime", "noRealtime", "late"]);
    expect(input.map((d) => d.id)).toEqual(["late", "noRealtime", "onTime"]);
  });

  it("sortiert bei Gleichstand nach Plan und Linie", () => {
    const t = "2026-11-13T12:05:00Z";
    const sorted = sortDepartures([
      departure({ id: "u79", line: "U79", plannedTime: t, realtimeTime: t }),
      departure({
        id: "earlyPlan",
        line: "U83",
        plannedTime: "2026-11-13T12:01:00Z",
        realtimeTime: t,
      }),
      departure({ id: "u7", line: "U7", plannedTime: t, realtimeTime: t }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(["earlyPlan", "u7", "u79"]);
  });
});

describe("upcomingDepartures", () => {
  it("blendet Fahrten aus, die länger als eine Minute vorbei sind", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const result = upcomingDepartures(
      [
        departure({ id: "gone", realtimeTime: "2026-11-13T11:58:30Z" }),
        departure({ id: "justGone", realtimeTime: "2026-11-13T11:59:30Z" }),
        departure({ id: "next", realtimeTime: "2026-11-13T12:03:00Z" }),
      ],
      now,
    );
    expect(result.map((d) => d.id)).toEqual(["justGone", "next"]);
  });
});

describe("hasPlatformChange", () => {
  it("erkennt nur echte Gleiswechsel", () => {
    expect(hasPlatformChange(departure({ id: "a", platform: "3", plannedPlatform: "4" }))).toBe(
      true,
    );
    expect(hasPlatformChange(departure({ id: "b", platform: "3", plannedPlatform: "3" }))).toBe(
      false,
    );
    expect(hasPlatformChange(departure({ id: "c", platform: "3", plannedPlatform: null }))).toBe(
      false,
    );
    expect(hasPlatformChange(departure({ id: "d", platform: null, plannedPlatform: "3" }))).toBe(
      false,
    );
  });
});
