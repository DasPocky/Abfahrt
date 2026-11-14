import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Journey, JourneysResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { paging } from "../../worker/journeys";
import { resetRateLimit } from "../../worker/rate-limit";
import * as transitousTrips from "../../worker/sources/transitous-trips";
import * as vrrTrips from "../../worker/sources/vrr-trips";
import transitousPlan from "./fixtures/transitous-plan.json";
import vrrTrip from "./fixtures/vrr-trip.json";

const API = `https://endlab.test${API_PREFIX}`;
const HHA = "vrr:de:05111:18036";
const ESSEN = "vrr:de:05113:9289";
const BERLIN = "transitous:de-DELFI_de:11000:900003201";

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
let minuteOffset = 0;
/** eigene IP und eigene Minute pro Test, damit Rate-Limit und Cache sich nicht stören */
function get(query: string) {
  const when = new Date(Date.now() + ++minuteOffset * 60 * 60_000).toISOString();
  return exports.default.fetch(`${API}journeys?${query}&when=${encodeURIComponent(when)}`, {
    headers: { "CF-Connecting-IP": `10.1.0.${++ipCounter}` },
  });
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("VRR-Verbindungen", () => {
  it("normalisiert Abschnitte mit Echtzeit, Gleis und Zwischenhalten", async () => {
    mockUpstream({ XML_TRIP_REQUEST2: vrrTrip });
    const journey = (await vrrTrips.trips(HHA, ESSEN, undefined, false)).journeys[2];
    expect(journey?.transfers).toBe(1);
    const [u73, s6] = journey?.legs ?? [];
    expect(u73).toMatchObject({
      kind: "transit",
      line: "U73",
      mode: "subway",
      origin: { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U" },
      destination: { name: "Wehrhahn S" },
    });
    expect(s6).toMatchObject({ line: "S6", mode: "suburban", direction: expect.any(String) });
    expect(s6?.origin).toMatchObject({
      plannedDeparture: "2026-11-14T20:02:00Z",
      realtimeDeparture: "2026-11-14T20:03:00Z",
      platform: "2",
    });
    expect(s6?.intermediateStops[0]).toMatchObject({ name: "Zoo S", platform: "2" });
    expect(s6?.destination).toMatchObject({ name: "Essen Hauptbahnhof", platform: "12" });
  });

  it("benennt Fernzüge mit Zuggattung und Nummer", async () => {
    mockUpstream({ XML_TRIP_REQUEST2: vrrTrip });
    const journey = (await vrrTrips.trips(HHA, ESSEN, undefined, false)).journeys[0];
    expect(journey?.legs.map((l) => l.line)).toEqual(["U75", "ICE 620"]);
    expect(journey?.legs[1]?.mode).toBe("longdistance");
    expect(journey?.legs[1]?.notices.length).toBeGreaterThan(0);
  });
});

describe("Transitous-Verbindungen", () => {
  it("normalisiert Fahrten und Fußwege, VRR-Haltestellen behalten die VRR-ID", async () => {
    mockUpstream({ "transitous.org/api/v5/plan": transitousPlan });
    const journey = (await transitousTrips.trips(HHA, BERLIN, undefined, false)).journeys[0];
    expect(journey?.legs.map((l) => l.kind)).toEqual(["transit", "walk", "transit"]);
    expect(journey?.transfers).toBe(1);
    const [u75, walk, ice] = journey?.legs ?? [];
    expect(u75).toMatchObject({ line: "U75", mode: "subway", lineColor: expect.any(String) });
    expect(u75?.origin.id).toBe("vrr:de:05111:18036");
    expect(walk).toMatchObject({ line: null, mode: null, distanceMeters: 120 });
    expect(walk?.origin.plannedArrival).toBeNull();
    expect(ice).toMatchObject({ line: "ICE 1541", mode: "longdistance" });
    // Gleiswechsel 18 → 10
    expect(ice?.origin).toMatchObject({ platform: "10", plannedPlatform: "18" });
  });

  it("übersetzt App-IDs in Transitous-IDs", () => {
    expect(transitousTrips.planPlaceId("vrr:de:05111:18036")).toBe("de-DELFI_de:05111:18036");
    expect(transitousTrips.planPlaceId(BERLIN)).toBe("de-DELFI_de:11000:900003201");
  });
});

function at(iso: string): Journey {
  return {
    id: iso,
    transfers: 0,
    durationMinutes: 10,
    legs: [
      {
        kind: "transit",
        origin: {
          id: null,
          name: "A",
          plannedArrival: null,
          realtimeArrival: null,
          plannedDeparture: iso,
          realtimeDeparture: null,
          platform: null,
          plannedPlatform: null,
          cancelled: false,
        },
        destination: {
          id: null,
          name: "B",
          plannedArrival: iso,
          realtimeArrival: null,
          plannedDeparture: null,
          realtimeDeparture: null,
          platform: null,
          plannedPlatform: null,
          cancelled: false,
        },
        durationMinutes: 10,
        distanceMeters: null,
        line: "U75",
        mode: "subway",
        direction: null,
        lineColor: null,
        lineTextColor: null,
        intermediateStops: [],
        cancelled: false,
        notices: [],
      },
    ],
  };
}

describe("Früher/Später", () => {
  it("springt eine Listenlänge zurück und hinter die letzte Abfahrt", () => {
    expect(paging([at("2026-11-14T20:00:00Z"), at("2026-11-14T20:40:00Z")])).toEqual({
      earlier: "2026-11-14T19:20:00.000Z",
      later: "2026-11-14T20:41:00.000Z",
    });
  });

  it("geht mindestens 20 Minuten zurück und liefert ohne Verbindungen null", () => {
    expect(paging([at("2026-11-14T20:00:00Z")]).earlier).toBe("2026-11-14T19:40:00.000Z");
    expect(paging([])).toEqual({ earlier: null, later: null });
  });
});

describe("API journeys", () => {
  it("nutzt im VRR-Gebiet den VRR", async () => {
    const calls = mockUpstream({ XML_TRIP_REQUEST2: vrrTrip });
    const res = await get(`from=${HHA}&to=${ESSEN}`);
    expect(res.status).toBe(200);
    const body = await res.json<JourneysResponse>();
    expect(body.source).toBe("vrr");
    expect(body.journeys).toHaveLength(3);
    expect(body.from).toMatchObject({
      id: HHA,
      name: "Heinrich-Heine-Allee U",
      place: "Düsseldorf",
    });
    expect(body.to).toMatchObject({ id: ESSEN, name: "Essen Hauptbahnhof" });
    expect(body.later).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("itdTripDateTimeDepArr=dep");
    // DHID ohne App-Präfix an den VRR
    expect(calls[0]).toContain("name_origin=de%3A05111%3A18036&");
    expect(calls[0]).toContain("name_destination=de%3A05113%3A9289");
  });

  it("nutzt außerhalb des VRR Transitous", async () => {
    const calls = mockUpstream({ "transitous.org/api/v5/plan": transitousPlan });
    const res = await get(`from=${HHA}&to=${BERLIN}`);
    const body = await res.json<JourneysResponse>();
    expect(body.source).toBe("transitous");
    expect(body.journeys.length).toBeGreaterThan(0);
    expect(calls[0]).toContain("fromPlace=de-DELFI_de%3A05111%3A18036");
    expect(calls[0]).toContain("arriveBy=false");
  });

  it("weicht auf Transitous aus, wenn der VRR nicht antwortet", async () => {
    mockUpstream({ "transitous.org/api/v5/plan": transitousPlan });
    const body = await (await get(`from=${HHA}&to=${ESSEN}&arrive=1`)).json<JourneysResponse>();
    expect(body.source).toBe("transitous");
  });

  it("meldet unbekannte Haltestellen als 404", async () => {
    mockUpstream({
      XML_TRIP_REQUEST2: {
        systemMessages: [
          { type: "error", module: "BROKER", code: -8011, text: "origin: multiple matches" },
        ],
      },
    });
    const res = await get(`from=vrr:de:05111:99999&to=${ESSEN}`);
    expect(res.status).toBe(404);
  });

  it.each([
    ["from=abc&to=" + ESSEN, "invalid_stop"],
    [`from=${HHA}&to=${HHA}`, "same_stop"],
  ])("lehnt ungültige Anfragen ab (%s)", async (query, error) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error });
  });

  it("lehnt Zeitpunkte zu weit in der Zukunft ab", async () => {
    const res = await exports.default.fetch(
      `${API}journeys?from=${HHA}&to=${ESSEN}&when=2030-01-01T00:00:00Z`,
      { headers: { "CF-Connecting-IP": "10.1.1.1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_when" });
  });
});

describe("Quellenwahl", () => {
  it("fragt mit Transitous-IDs nie den VRR", async () => {
    const calls = mockUpstream({ "transitous.org/api/v5/plan": { itineraries: [] } });
    const res = await get(`from=${BERLIN}&to=transitous:de-DELFI_de:11000:900100003`);
    expect(res.status).toBe(200);
    expect((await res.json<JourneysResponse>()).journeys).toEqual([]);
    expect(calls.every((u) => !u.includes("openservice.vrr.de"))).toBe(true);
  });
});
