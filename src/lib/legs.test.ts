import { describe, expect, it } from "vitest";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import { arrivalOf, departureOf, nextLegStart } from "./legs";

describe("Etappen-Zeiten (#110)", () => {
  const j = journey({
    id: "j",
    legs: [
      journeyLeg({
        origin: journeyStop({
          name: "A",
          plannedDeparture: "2026-11-17T12:00:00Z",
          realtimeDeparture: "2026-11-17T12:02:00Z",
        }),
        destination: journeyStop({
          name: "B",
          plannedArrival: "2026-11-17T12:30:00Z",
          realtimeArrival: "2026-11-17T12:33:00Z",
        }),
      }),
    ],
  });

  it("nimmt Echtzeit vor Plan", () => {
    expect(new Date(departureOf(j)).toISOString()).toBe("2026-11-17T12:02:00.000Z");
    expect(new Date(arrivalOf(j)).toISOString()).toBe("2026-11-17T12:33:00.000Z");
  });

  it("startet die nächste Etappe nach Ankunft plus Aufenthalt", () => {
    expect(nextLegStart(j, 10)).toBe("2026-11-17T12:43:00.000Z");
    expect(nextLegStart(j, 0)).toBe("2026-11-17T12:33:00.000Z");
  });
});
