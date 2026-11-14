import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeparturesResponse, StopSearchResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import transitousGeocode from "./fixtures/transitous-geocode.json";
import transitousGeocodeHha from "./fixtures/transitous-geocode-hha.json";
import transitousReverse from "./fixtures/transitous-reverse.json";
import transitousColors from "./fixtures/transitous-stoptimes-colors.json";
import transitousStopTimes from "./fixtures/transitous-stoptimes.json";
import vrrCoord from "./fixtures/vrr-coord.json";
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

describe("Haltestellen in der Nähe", () => {
  it("liefert VRR-Haltestellen im Umkreis, nächste zuerst", async () => {
    const calls = mockUpstream({ XML_COORD_REQUEST: vrrCoord });
    const res = await get("stops/nearby?lat=51.22641&lon=6.77682");
    expect(res.status).toBe(200);
    const body = await res.json<StopSearchResponse>();
    expect(body.stops[0]).toMatchObject({
      id: "vrr:de:05111:18036",
      name: "Heinrich-Heine-Allee U",
      place: "Düsseldorf",
    });
    expect(body.stops.length).toBeGreaterThan(3);
    expect(body.stops.every((s) => s.id.startsWith("vrr:de:"))).toBe(true);
    // genauer als ~100 m verlässt die Position den Worker nicht
    expect(calls[0]).toContain("coord=6.777:51.226:");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("weicht auf Transitous aus, wenn der VRR nicht antwortet", async () => {
    mockUpstream({ "transitous.org/api/v1/reverse-geocode": transitousReverse });
    const res = await get("stops/nearby?lat=51.2251&lon=6.7752");
    const body = await res.json<StopSearchResponse>();
    expect(body.stops[0]?.id).toBe("transitous:de-DELFI_de:05111:18036");
  });

  it.each(["lat=51.2", "lat=abc&lon=6.7", "lat=40.1&lon=6.7", "lat=51.2&lon=6.7e1"])(
    "lehnt ungültige Positionen ab (%s)",
    async (query) => {
      const res = await get(`stops/nearby?${query}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "invalid_position" });
    },
  );
});

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

  it("bleibt im VRR-Gebiet für spätere Zeitpunkte beim VRR", async () => {
    const calls = mockUpstream({ XML_DM_REQUEST: vrrDmBerlin });
    const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
    const res = await get(`departures?stop=vrr:de:05111:18036&when=${tomorrow}`);
    const body = await res.json<DeparturesResponse>();
    expect(body.source).toBe("vrr");
    // Transitous nur für die Linienfarben, nicht für die Abfahrten
    expect(calls.some((u) => u.includes("v5/stoptimes") && !u.includes("window=1800"))).toBe(false);
  });

  it("ergänzt VRR-Abfahrten um Linienfarben aus Transitous und cached die Zuordnung", async () => {
    // eigene Haltestellen-ID, damit kein Cache-Eintrag anderer Tests greift
    const dm = shiftTimes(
      { ...vrrDm, locations: [{ ...vrrDm.locations[0], id: "de:05111:18036:test-farben" }] },
      vrrDm.stopEvents[0]!.departureTimePlanned,
    );
    const calls = mockUpstream({
      XML_DM_REQUEST: dm,
      "v1/geocode": transitousGeocodeHha,
      "v5/stoptimes": transitousColors,
    });
    const res = await get("departures?stop=vrr:de:05111:18036.farben");
    const body = await res.json<DeparturesResponse>();
    expect(body.source).toBe("vrr");
    const byLine = new Map(body.departures.map((d) => [d.line, d]));
    expect(byLine.get("U79")).toMatchObject({ lineColor: "009a93", lineTextColor: "ffffff" });
    expect(byLine.get("U71")).toMatchObject({ lineColor: "59c6f2", lineTextColor: "000000" });
    const subwayColors = new Set(
      body.departures.filter((d) => d.mode === "subway").map((d) => d.lineColor),
    );
    expect(subwayColors.size).toBeGreaterThan(5);
    expect(subwayColors.has(null)).toBe(false);
    const colorCall = calls.find((u) => u.includes("v5/stoptimes"));
    expect(colorCall).toContain("stopId=de-DELFI_de%3A05111%3A18036");
    expect(colorCall).toContain("window=1800");

    // zweiter Abruf (andere Minute) nutzt die gecachte Zuordnung
    await new Promise((resolve) => setTimeout(resolve, 50));
    const before = calls.length;
    const soon = new Date(Date.now() + 90_000).toISOString();
    const again = await get(`departures?stop=vrr:de:05111:18036.farben&when=${soon}`);
    const againBody = await again.json<DeparturesResponse>();
    expect(againBody.departures.some((d) => d.lineColor === "009a93")).toBe(true);
    expect(calls.slice(before).some((u) => u.includes("transitous"))).toBe(false);
  });

  it("liefert VRR-Abfahrten ohne Farben, wenn Transitous ausfällt", async () => {
    const dm = shiftTimes(
      { ...vrrDm, locations: [{ ...vrrDm.locations[0], id: "de:05111:18036:test-ausfall" }] },
      vrrDm.stopEvents[0]!.departureTimePlanned,
    );
    const calls = mockUpstream({ XML_DM_REQUEST: dm });
    const res = await get("departures?stop=vrr:de:05111:18036.ausfall");
    expect(res.status).toBe(200);
    const body = await res.json<DeparturesResponse>();
    expect(body.source).toBe("vrr");
    expect(body.departures.length).toBeGreaterThan(0);
    expect(body.departures.every((d) => d.lineColor === null)).toBe(true);
    expect(calls.some((u) => u.includes("transitous"))).toBe(true);
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
