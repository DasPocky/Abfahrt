import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Journey, JourneysResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { dedupeJourneys, dropDeparted, orderJourneys, paging } from "../../worker/journeys";
import { resetRateLimit } from "../../worker/rate-limit";
import * as transitousTrips from "../../worker/sources/transitous-trips";
import * as vrrTrips from "../../worker/sources/vrr-trips";
import transitousGeocodeHha from "./fixtures/transitous-geocode-hha.json";
import transitousPlan from "./fixtures/transitous-plan.json";
import transitousColors from "./fixtures/transitous-stoptimes-colors.json";
import vrrTrip from "./fixtures/vrr-trip.json";
import vrrTripCoord from "./fixtures/vrr-trip-coord.json";

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

/** Beispieldaten so verschieben, dass die erste Abfahrt in 2 Minuten liegt */
function shiftTimes(data: unknown, firstIso: string): unknown {
  const offset = Date.now() + 2 * 60_000 - Date.parse(firstIso);
  const text = JSON.stringify(data).replace(
    /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g,
    (_, iso: string) => JSON.stringify(new Date(Date.parse(iso) + offset).toISOString()),
  );
  return JSON.parse(text);
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
    // Ort aus dem Städtekürzel, Ziel in derselben Stadt ohne Ort (#94)
    expect(u75?.origin).toMatchObject({ name: "Heinrich-Heine-Allee U", place: "Düsseldorf" });
    expect(u75?.direction).toBe("Lierenfeld Btf");
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
        path: null,
      },
    ],
  };
}

/** Zwei Fahrten mit Umstieg an `stop`: an Steig `arrPlatform`, ab Steig `depPlatform` */
function viaTransfer(
  dep: string,
  arr: string,
  stop: string,
  arrPlatform: string,
  depPlatform: string,
  second: string,
): Journey {
  const [first] = at(`2026-11-17T${dep}:00Z`).legs;
  const [next] = at(`2026-11-17T${arr}:00Z`).legs;
  return {
    id: `${dep}-${stop}`,
    transfers: 1,
    durationMinutes: 40,
    legs: [
      {
        ...first!,
        line: "U83",
        destination: { ...first!.destination, id: stop, platform: arrPlatform },
      },
      {
        ...next!,
        line: second,
        origin: {
          ...next!.origin,
          id: stop,
          platform: depPlatform,
          plannedDeparture: `2026-11-17T${dep.slice(0, 3)}30:00Z`,
        },
      },
    ],
  };
}

describe("Umstieg am selben Steig (#97)", () => {
  it("bevorzugt auch weniger Fußweg beim Umsteigen", () => {
    const [ride1, ride2] = platformChange.legs;
    const walk = {
      ...ride1!,
      kind: "walk" as const,
      line: null,
      mode: null,
      durationMinutes: 4,
    };
    const walking: Journey = { ...platformChange, id: "walk", legs: [ride1!, walk, ride2!] };
    // gleiche Ankunft: Steigwechsel ohne Fußweg (2 Punkte) vor 4 Min Fußweg (6 Punkte)
    expect(orderJourneys([walking, platformChange]).map((j) => j.id)).toEqual([
      platformChange.id,
      "walk",
    ]);
  });

  // Auf der Hardt → Holthausen, 12:02 mit der U83 (Zeiten vereinfacht)
  const platformChange = viaTransfer("12:02", "12:40", "vrr:hha", "6", "4", "U76");
  const samePlatform = viaTransfer("12:02", "12:43", "vrr:schlueter", "1", "1", "U72");

  it("stellt die Variante am selben Steig vor, wenn sie höchstens 5 Min später ankommt", () => {
    expect(orderJourneys([platformChange, samePlatform]).map((j) => j.legs[1]?.line)).toEqual([
      "U72",
      "U76",
    ]);
  });

  it("lässt die schnellere vorn, wenn die bequeme deutlich später ankommt", () => {
    const late = viaTransfer("12:02", "12:50", "vrr:schlueter", "1", "1", "U72");
    expect(orderJourneys([late, platformChange]).map((j) => j.legs[1]?.line)).toEqual([
      "U76",
      "U72",
    ]);
  });

  it("sortiert sonst nach Abfahrt", () => {
    const later = viaTransfer("12:09", "12:50", "vrr:hha", "6", "4", "U76");
    expect(orderJourneys([later, platformChange]).map((j) => j.id)).toEqual([
      platformChange.id,
      later.id,
    ]);
  });
});

describe("Früher/Später", () => {
  it("springt eine Listenlänge zurück und hinter die letzte Abfahrt", () => {
    expect(paging([at("2026-11-14T20:00:00Z"), at("2026-11-14T20:40:00Z")])).toEqual({
      earlier: "2026-11-14T19:20:00.000Z",
      later: "2026-11-14T20:41:00.000Z",
    });
  });

  it("lässt abgefahrene Verbindungen weg, mit 1 Minute Toleranz", () => {
    const now = Date.parse("2026-11-14T20:00:00Z");
    const kept = dropDeparted(
      [at("2026-11-14T19:50:00Z"), at("2026-11-14T19:59:30Z"), at("2026-11-14T20:10:00Z")],
      now,
    );
    expect(kept.map((j) => j.id)).toEqual(["2026-11-14T19:59:30Z", "2026-11-14T20:10:00Z"]);
  });

  it("entfernt doppelte Verbindungen", () => {
    const twin = { ...at("2026-11-14T20:00:00Z"), id: "anders" };
    expect(
      dedupeJourneys([at("2026-11-14T20:00:00Z"), twin, at("2026-11-14T20:10:00Z")]),
    ).toHaveLength(2);
  });

  it("geht mindestens 20 Minuten zurück und liefert ohne Verbindungen null", () => {
    expect(paging([at("2026-11-14T20:00:00Z")]).earlier).toBe("2026-11-14T19:40:00.000Z");
    expect(paging([])).toEqual({ earlier: null, later: null });
  });
});

describe("API journeys", () => {
  it("nutzt im VRR-Gebiet den VRR", async () => {
    // Fixture beginnt 19:29 (eine Verbindung liegt vor dem Suchzeitpunkt und fällt weg)
    const calls = mockUpstream({
      XML_TRIP_REQUEST2: shiftTimes(vrrTrip, "2026-11-14T19:29:00Z"),
      // Linienfarben je Einstiegshaltestelle aus Transitous
      "v1/geocode": transitousGeocodeHha,
      "v5/stoptimes": transitousColors,
    });
    const res = await exports.default.fetch(`${API}journeys?from=${HHA}&to=${ESSEN}`, {
      headers: { "CF-Connecting-IP": "10.1.2.1" },
    });
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
    // zweite Abfrage „wenig Fußweg“ für Umstiege am selben Steig (#97)
    const vrrCalls = calls.filter((u) => u.includes("openservice.vrr.de"));
    expect(vrrCalls).toHaveLength(2);
    expect(
      vrrCalls.filter((u) => u.includes("ptOptionsActive=1&routeType=LEASTWALKING")),
    ).toHaveLength(1);
    expect(calls.some((u) => u.includes("v5/plan"))).toBe(false);
    const subway = body.journeys.flatMap((j) => j.legs).find((l) => l.mode === "subway");
    expect(subway?.lineColor).toMatch(/^[0-9a-f]{6}$/);
    expect(calls[0]).toContain("itdTripDateTimeDepArr=dep");
    expect(calls[0]).toContain("itdDate=");
    // DHID ohne App-Präfix an den VRR
    expect(calls[0]).toContain("name_origin=de%3A05111%3A18036&");
    expect(calls[0]).toContain("name_destination=de%3A05113%3A9289");
  });

  it("nutzt außerhalb des VRR Transitous", async () => {
    const calls = mockUpstream({
      "transitous.org/api/v5/plan": shiftTimes(transitousPlan, "2026-11-14T22:29:00Z"),
    });
    const res = await exports.default.fetch(`${API}journeys?from=${HHA}&to=${BERLIN}`, {
      headers: { "CF-Connecting-IP": "10.1.2.2" },
    });
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

describe("Optionen", () => {
  const options = "exclude=longdistance,bus&maxTransfers=1&transfer=slow&accessible=1";

  it("gibt die Optionen an den VRR weiter", async () => {
    const calls = mockUpstream({
      XML_TRIP_REQUEST2: { journeys: [] },
      "v5/plan": { itineraries: [] },
    });
    await get(`from=${HHA}&to=${ESSEN}&${options}`);
    const url = calls.find((u) => u.includes("XML_TRIP_REQUEST2")) ?? "";
    expect(url).toContain("&excludedMeans=checkbox");
    for (const cls of [14, 15, 16, 5, 6, 7, 10, 17, 19]) expect(url).toContain(`&exclMOT_${cls}=1`);
    expect(url).not.toContain("exclMOT_2=");
    expect(url).toContain("&maxChanges=1");
    expect(url).toContain("&changeSpeed=slow");
    expect(url).toContain("&wheelchair=on");
  });

  it("gibt die Optionen an Transitous weiter", async () => {
    const calls = mockUpstream({ "v5/plan": { itineraries: [] } });
    await get(`from=${HHA}&to=${BERLIN}&${options}`);
    const url = new URL(calls.find((u) => u.includes("v5/plan")) ?? "https://x");
    const modes = url.searchParams.get("transitModes")?.split(",") ?? [];
    expect(modes).toContain("SUBWAY");
    expect(modes).toContain("REGIONAL_RAIL");
    for (const m of ["HIGHSPEED_RAIL", "LONG_DISTANCE", "BUS", "COACH", "RAIL"]) {
      expect(modes).not.toContain(m);
    }
    expect(url.searchParams.get("maxTransfers")).toBe("1");
    expect(url.searchParams.get("minTransferTime")).toBe("5");
    expect(url.searchParams.get("pedestrianProfile")).toBe("WHEELCHAIR");
  });

  it("gibt die neuen VRR-Optionen weiter (#101)", async () => {
    const calls = mockUpstream({
      XML_TRIP_REQUEST2: { journeys: [] },
      "v5/plan": { itineraries: [] },
    });
    const extra =
      "route=fewTransfers&noStairs=1&lowFloor=1&bike=1&nearby=1&via=vrr:de:05111:18235&viaStay=10";
    await get(`from=${HHA}&to=${ESSEN}&${extra}`);
    const vrr = calls.filter((u) => u.includes("XML_TRIP_REQUEST2"));
    // eigene Routenwahl: keine bequeme Zusatzabfrage
    expect(vrr).toHaveLength(1);
    const url = vrr[0] ?? "";
    expect(url).toContain("&ptOptionsActive=1&routeType=LEASTINTERCHANGE&bikeTakeAlong=1");
    expect(url).toContain("&imparedOptionsActive=1&noSolidStairs=on&lowPlatformVhcl=on");
    expect(url).not.toContain("wheelchair=on");
    expect(url).toContain("&useProxFootSearch=1");
    expect(url).toContain("&type_via=any&name_via=de%3A05111%3A18235&dwellTimeMinutes=10");
  });

  it("gibt den Zwischenhalt an Transitous weiter (#101)", async () => {
    const calls = mockUpstream({ "v5/plan": { itineraries: [] } });
    await get(`from=${HHA}&to=${BERLIN}&via=vrr:de:05111:18235&viaStay=5&noStairs=1`);
    const url = new URL(calls.find((u) => u.includes("v5/plan")) ?? "https://x");
    expect(url.searchParams.get("via")).toBe("de-DELFI_de:05111:18235");
    expect(url.searchParams.get("viaMinimumStay")).toBe("5");
    expect(url.searchParams.get("pedestrianProfile")).toBe("WHEELCHAIR");
  });

  it.each([
    "exclude=auto",
    "maxTransfers=9",
    "transfer=turbo",
    "accessible=ja",
    "route=bequem",
    "via=foo",
  ])("lehnt ungültige Optionen ab (%s)", async (query) => {
    const res = await get(`from=${HHA}&to=${ESSEN}&${query}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_options" });
  });
});

describe("Adressen und POIs", () => {
  const KOE = "geo:51.22603,6.77840";

  it("fragt den VRR mit Koordinate und liefert die geo-ID zurück", async () => {
    const calls = mockUpstream({
      XML_TRIP_REQUEST2: shiftTimes(vrrTripCoord, "2026-11-16T06:49:00Z"),
      "v1/geocode": transitousGeocodeHha,
      "v5/stoptimes": transitousColors,
    });
    const res = await exports.default.fetch(`${API}journeys?from=${KOE}&to=${ESSEN}`, {
      headers: { "CF-Connecting-IP": "10.1.3.1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<JourneysResponse>();
    expect(body.source).toBe("vrr");
    expect(body.from).toMatchObject({ id: KOE, name: "Königsallee 1" });
    const first = body.journeys[0]?.legs[0];
    expect(first).toMatchObject({ kind: "walk", distanceMeters: 236 });
    expect(first?.origin).toMatchObject({ id: null, name: "Königsallee 1" });
    const url = calls.find((u) => u.includes("XML_TRIP_REQUEST2")) ?? "";
    expect(url).toContain("&type_origin=coord&name_origin=6.7784%3A51.22603%3AWGS84");
  });

  it("gibt Koordinaten an Transitous als lat,lon weiter", () => {
    expect(transitousTrips.planPlaceId(KOE)).toBe("51.22603,6.7784");
  });

  it.each(["geo:51.2,6.7,1", "geo:10.00000,6.70000", "geo:abc"])(
    "lehnt ungültige Koordinaten ab (%s)",
    async (id) => {
      const res = await get(`from=${encodeURIComponent(id)}&to=${ESSEN}`);
      expect(res.status).toBe(400);
    },
  );
});
