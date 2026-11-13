import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeparturesResponse, StopSearchResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import transitousGeocode from "./fixtures/transitous-geocode.json";
import transitousStopTimes from "./fixtures/transitous-stoptimes.json";
import vrrDmBerlin from "./fixtures/vrr-dm-berlin.json";
import vrrDm from "./fixtures/vrr-dm.json";
import vrrStopfinder from "./fixtures/vrr-stopfinder.json";

const API = `https://endlab.test${API_PREFIX}`;

/** Beispieldaten so verschieben, dass die erste Abfahrt in 2 Minuten liegt */
function shiftTimes(data: unknown, firstIso: string): unknown {
  const offset = Date.now() + 2 * 60_000 - Date.parse(firstIso);
  const text = JSON.stringify(data).replace(
    /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g,
    (_, iso: string) => JSON.stringify(new Date(Date.parse(iso) + offset).toISOString()),
  );
  return JSON.parse(text);
}

function mockUpstream(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    for (const [part, body] of Object.entries(routes)) {
      if (url.includes(part)) return Response.json(body);
    }
    return new Response("unerwartet", { status: 500 });
  });
  return calls;
}

let ipCounter = 0;
function get(path: string) {
  // eigene IP pro Test, damit Rate-Limit und Cache-Schlüssel sich nicht stören
  return exports.default.fetch(`${API}${path}`, {
    headers: { "CF-Connecting-IP": `10.0.0.${++ipCounter}` },
  });
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("Haltestellensuche", () => {
  it("liefert VRR-Haltestellen", async () => {
    mockUpstream({ XML_STOPFINDER_REQUEST: vrrStopfinder });
    const res = await get("stops/search?q=Heinrich-Heine-Allee");
    expect(res.status).toBe(200);
    const body = await res.json<StopSearchResponse>();
    expect(body.stops[0]).toMatchObject({
      id: "vrr:de:05111:18036",
      name: "Heinrich-Heine-Allee U",
      place: "Düsseldorf",
    });
  });

  it("weicht auf Transitous aus, wenn der VRR nicht antwortet", async () => {
    mockUpstream({ "transitous.org/api/v1/geocode": transitousGeocode });
    const res = await get("stops/search?q=Berlin%20Hbf%20Test");
    const body = await res.json<StopSearchResponse>();
    expect(body.stops[0]?.id).toMatch(/^transitous:/);
  });

  it("lehnt zu kurze Suchbegriffe ab", async () => {
    const res = await get("stops/search?q=a");
    expect(res.status).toBe(400);
  });
});

describe("Abfahrten", () => {
  it("nutzt im VRR-Gebiet den VRR mit Echtzeit, sortiert nach Abfahrt", async () => {
    mockUpstream({ XML_DM_REQUEST: shiftTimes(vrrDm, vrrDm.stopEvents[0]!.departureTimePlanned) });
    const res = await get("departures?stop=vrr:de:05111:18036");
    expect(res.status).toBe(200);
    const body = await res.json<DeparturesResponse>();
    expect(body.source).toBe("vrr");
    expect(body.stop.name).toBe("Heinrich-Heine-Allee U");
    const times = body.departures.map((d) => Date.parse(d.realtimeTime ?? d.plannedTime));
    expect(times).toEqual(times.toSorted((a, b) => a - b));
  });

  it("nutzt außerhalb des VRR Transitous", async () => {
    const calls = mockUpstream({
      XML_DM_REQUEST: vrrDmBerlin,
      "v1/geocode": transitousGeocode,
      "v5/stoptimes": shiftTimes(
        transitousStopTimes,
        transitousStopTimes.stopTimes[0]!.place.scheduledDeparture,
      ),
    });
    const res = await get("departures?stop=vrr:de:11000:900003201");
    const body = await res.json<DeparturesResponse>();
    expect(body.source).toBe("transitous");
    expect(body.departures.length).toBeGreaterThan(0);
    expect(calls.some((u) => u.includes("v5/stoptimes"))).toBe(true);
  });

  it("validiert die Haltestellen-ID", async () => {
    expect((await get("departures?stop=../../etc")).status).toBe(400);
    expect((await get("departures?stop=vrr:de:05111:18036&when=morgen")).status).toBe(400);
  });

  it("meldet 502, wenn die Quelle ausfällt", async () => {
    mockUpstream({});
    const res = await get("departures?stop=vrr:de:05111:99999");
    expect(res.status).toBe(502);
  });
});

describe("Rate-Limit", () => {
  it("begrenzt viele Anfragen derselben IP", async () => {
    mockUpstream({ XML_STOPFINDER_REQUEST: vrrStopfinder });
    let last = 0;
    for (let i = 0; i < 61; i++) {
      const res = await exports.default.fetch(`${API}stops/search?q=Heine${i % 3}`, {
        headers: { "CF-Connecting-IP": "10.9.9.9" },
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
