import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TripResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import * as transitous from "../../worker/sources/transitous";
import * as vrr from "../../worker/sources/vrr";
import { efaTripRef, parseTripRef, transitousTripRef } from "../../worker/trip-ref";
import transitousStopTimes from "./fixtures/transitous-stoptimes.json";
import transitousTrip from "./fixtures/transitous-trip.json";
import vrrDm from "./fixtures/vrr-dm.json";
import vrrStopSeq from "./fixtures/vrr-stopseq.json";

describe("Verweis auf eine Fahrt (#120)", () => {
  it("baut und liest EFA-Verweise, auch mit Leerzeichen in der Linien-ID", () => {
    const ref = efaTripRef("vrr", "rbg:70076: :H:j26", "de:05111:18036:8:4", 462, {
      date: "20261118",
      time: "1221",
    });
    expect(ref).toBe("efa|vrr|rbg:70076: :H:j26|de:05111:18036:8:4|462|202611181221");
    expect(parseTripRef(ref!)).toEqual({
      kind: "efa",
      source: "vrr",
      line: "rbg:70076: :H:j26",
      stop: "de:05111:18036:8:4",
      tripCode: "462",
      date: "20261118",
      time: "1221",
    });
  });

  it("baut und liest Transitous-Verweise", () => {
    const ref = transitousTripRef("20261118_12:28_de-DELFI_3473645480");
    expect(parseTripRef(ref!)).toEqual({
      kind: "transitous",
      tripId: "20261118_12:28_de-DELFI_3473645480",
    });
  });

  it("lehnt kaputte oder fremde Verweise ab", () => {
    for (const raw of [
      null,
      "",
      "efa|mvv|x|y|1|202611181221",
      "efa|vrr|x|y|abc|202611181221",
      "efa|vrr|x|y|1|2026",
      "transitous|",
      "transitous|a|b",
      `transitous|${"x".repeat(400)}`,
      "http://example.com",
    ]) {
      expect(parseTripRef(raw)).toBeNull();
    }
    expect(efaTripRef("vrr", "a|b", "s", 1, { date: "20261118", time: "1200" })).toBeUndefined();
    expect(
      efaTripRef("vrr", undefined, "s", 1, { date: "20261118", time: "1200" }),
    ).toBeUndefined();
  });

  it("hängt den Verweis an VRR- und Transitous-Abfahrten", () => {
    const dep = vrr.toDeparture(vrrDm.stopEvents[0]!, 0);
    expect(parseTripRef(dep?.tripRef ?? null)?.kind).toBe("efa");
    const st = transitous.toDeparture(transitousStopTimes.stopTimes[0]!, 0);
    expect(st?.tripRef).toMatch(/^transitous\|/);
  });
});

const API = `https://endlab.test${API_PREFIX}`;
const VRR_REF = "efa|vrr|rbg:70076: :H:j26|de:05111:18036:8:4|462|202611181221";
const TRANSITOUS_REF = "transitous|20261118_12:28_de-DELFI_3473645480";

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
function getTrip(ref: string) {
  return exports.default.fetch(`${API}trip?ref=${encodeURIComponent(ref)}`, {
    headers: { "CF-Connecting-IP": `10.2.0.${++ipCounter}` },
  });
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("API trip (#120)", () => {
  it("liefert eine VRR-Fahrt mit allen Halten, Echtzeit, Gleis und Strecke", async () => {
    const calls = mockUpstream({ XML_STOPSEQCOORD_REQUEST: vrrStopSeq });
    const res = await getTrip(VRR_REF);
    expect(res.status).toBe(200);
    const body: TripResponse = await res.json();
    expect(body.source).toBe("vrr");
    const { leg } = body;
    expect(leg.line).toBe("U76");
    expect(leg.mode).toBe("subway");
    expect(leg.origin.name).toBe("Krefeld Rheinstraße");
    expect(leg.origin.id).toBe("vrr:de:05114:21001");
    expect(leg.origin.realtimeDeparture).toBe("2026-11-18T10:46:30Z");
    expect(leg.intermediateStops).toHaveLength(3);
    expect(leg.intermediateStops[0]?.platform).toBe("12");
    expect(leg.destination.plannedArrival).toBe("2026-11-18T11:40:00Z");
    expect(leg.durationMinutes).toBe(61);
    expect(leg.path?.length).toBeGreaterThan(1);

    const url = new URL(calls.find((c) => c.includes("XML_STOPSEQCOORD_REQUEST"))!);
    expect(url.searchParams.get("line")).toBe("rbg:70076: :H:j26");
    expect(url.searchParams.get("tripCode")).toBe("462");
    expect(url.searchParams.get("date")).toBe("20261118");
    expect(url.searchParams.get("time")).toBe("1221");
  });

  it("liefert eine Transitous-Fahrt", async () => {
    const calls = mockUpstream({ "/v5/trip": transitousTrip });
    const res = await getTrip(TRANSITOUS_REF);
    expect(res.status).toBe(200);
    const body: TripResponse = await res.json();
    expect(body.source).toBe("transitous");
    expect(body.leg.intermediateStops).toHaveLength(3);
    expect(body.leg.origin.plannedDeparture).toBe("2026-11-18T11:28:00Z");
    expect(calls.some((c) => c.includes("tripId=20261118_12%3A28_de-DELFI_3473645480"))).toBe(true);
  });

  it("antwortet mit 404, wenn die Quelle die Fahrt nicht kennt", async () => {
    mockUpstream({ XML_STOPSEQCOORD_REQUEST: { transportation: { locationSequence: [] } } });
    const res = await getTrip(VRR_REF.replace("462", "463"));
    expect(res.status).toBe(404);
  });

  it("antwortet bei ungültigem Verweis mit 400", async () => {
    const res = await getTrip("quatsch");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_trip" });
  });
});
