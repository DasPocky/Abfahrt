import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VehiclesResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import {
  MAX_VEHICLE_PATH_POINTS,
  toVehicleSegment,
  type TransitousTripSegment,
} from "../../worker/sources/transitous-vehicles";
// Aufgezeichnet am 17.11.2026: v5/map/trips?min=51.20,6.74&max=51.25,6.82 (Düsseldorf), gekürzt
import trips from "./fixtures/transitous-map-trips.json";

const API = `https://endlab.test${API_PREFIX}`;
const segments = trips as TransitousTripSegment[];

let ipCounter = 0;
function get(path: string) {
  return exports.default.fetch(`${API}${path}`, {
    headers: { "CF-Connecting-IP": `10.2.0.${++ipCounter}` },
  });
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("Fahrtabschnitte aus Transitous (#92)", () => {
  it("übernimmt Bahnen und Busse, lässt Flugzeuge weg", () => {
    const result = segments.map(toVehicleSegment);
    const kept = result.filter((s) => s !== null);
    expect(segments.some((s) => s.mode === "AIRPLANE")).toBe(true);
    expect(kept).toHaveLength(segments.length - 1);
    expect(new Set(kept.map((s) => s.mode))).toEqual(
      new Set(["tram", "subway", "bus", "suburban", "regional", "longdistance"]),
    );
    for (const s of kept) {
      expect(s.path.length).toBeGreaterThanOrEqual(2);
      expect(s.path.length).toBeLessThanOrEqual(MAX_VEHICLE_PATH_POINTS);
      expect(Date.parse(s.arrival)).toBeGreaterThanOrEqual(Date.parse(s.departure));
      expect(s.nextStop.startsWith("D-")).toBe(false);
    }
  });

  it("berechnet die Verspätung nur mit Echtzeit", () => {
    const base: TransitousTripSegment = {
      trips: [{ tripId: "t1", displayName: "U73" }],
      mode: "SUBWAY",
      routeColor: "0094D8",
      departure: "2026-11-17T09:05:00Z",
      arrival: "2026-11-17T09:07:00Z",
      scheduledDeparture: "2026-11-17T09:02:00Z",
      realTime: true,
      polyline: "u{vwHqqkh@oCqF",
      to: { name: "D-Uni Ost/Botanischer Garten" },
    };
    expect(toVehicleSegment(base)).toMatchObject({
      trip: "t1",
      line: "U73",
      mode: "subway",
      color: "0094d8",
      realtime: true,
      delayMinutes: 3,
      nextStop: "Uni Ost/Botanischer Garten",
    });
    expect(toVehicleSegment({ ...base, realTime: false })?.delayMinutes).toBeNull();
    // ohne Verlauf, ohne Fahrt-ID oder mit Ankunft vor Abfahrt: unbrauchbar
    expect(toVehicleSegment({ ...base, polyline: "" })).toBeNull();
    expect(toVehicleSegment({ ...base, trips: [] })).toBeNull();
    expect(toVehicleSegment({ ...base, arrival: "2026-11-17T09:00:00Z" })).toBeNull();
  });
});

function mockTransitous() {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.includes("transitous.org/api/v5/map/trips")) return Response.json(trips);
    return new Response("unerwartet", { status: 500 });
  });
  return calls;
}

describe("GET vehicles", () => {
  it("liefert Abschnitte für den gerundeten Ausschnitt ab der vollen Minute", async () => {
    const calls = mockTransitous();
    const res = await get("vehicles?min=51.22041,6.77013&max=51.22987,6.78466");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=30");
    const body = await res.json<VehiclesResponse>();
    expect(body.segments).toHaveLength(segments.length - 1);
    expect(body.from.endsWith(":00.000Z")).toBe(true);
    expect(Date.parse(body.to) - Date.parse(body.from)).toBe(3 * 60_000);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!);
    expect(url.searchParams.get("min")).toBe("51.22,6.77");
    expect(url.searchParams.get("max")).toBe("51.23,6.785");
    expect(url.searchParams.get("startTime")).toBe(body.from);
  });

  it("teilt sich den Cache-Eintrag innerhalb der Minute", async () => {
    const calls = mockTransitous();
    await get("vehicles?min=50.9351,6.9501&max=50.9449,6.9649");
    await get("vehicles?min=50.9352,6.9502&max=50.9448,6.9648");
    expect(calls).toHaveLength(1);
  });

  it("lehnt zu große Ausschnitte ab", async () => {
    const res = await get("vehicles?min=51.2,6.7&max=51.3,6.9");
    expect(res.status).toBe(400);
  });
});
