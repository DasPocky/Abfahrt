import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertsResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { htmlToText } from "../../worker/html-text";
import { resetRateLimit } from "../../worker/rate-limit";
import { areaAlerts, cityName, stopDhid } from "../../worker/sources/vrr-alerts";
import addinfo from "./fixtures/vrr-addinfo-duesseldorf.json";

const API = `https://endlab.test${API_PREFIX}`;

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

let ip = 0;
function get(query: string) {
  return exports.default.fetch(`${API}alerts?${query}`, {
    headers: { "CF-Connecting-IP": `10.2.0.${++ip}` },
  });
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("HTML zu Text", () => {
  it("entfernt Tags, löst Entities auf und behält Absätze", () => {
    expect(
      htmlToText(
        "<div>U-Bahnhof &bdquo;Nordstra&szlig;e&ldquo; ab 21. Mai<br />gesperrt.</div>\n<div>&nbsp;</div><b>Linie U79: </b>&amp; mehr&#8230;",
      ),
    ).toBe("U-Bahnhof „Nordstraße“ ab 21. Mai\ngesperrt.\nLinie U79: & mehr…");
  });
});

describe("VRR-Störungen", () => {
  it("normalisiert Meldungen der Gemeinde", async () => {
    const calls = mockUpstream({ XML_ADDINFO_REQUEST: addinfo });
    const alerts = await areaAlerts("5111000");
    expect(calls[0]).toContain("filterOMC=5111000");
    expect(calls[0]).toContain("filterShowLineList=0&filterShowStopList=0&filterShowPlaceList=0");
    // 30 Meldungen, davon 3 + 2 + 2 gleiche zusammengefasst
    expect(alerts).toHaveLength(26);
    const nordstrasse = alerts.filter((a) => a.title.includes("nicht am U-Bahnhof"));
    expect(nordstrasse).toHaveLength(1);
    expect(nordstrasse[0]?.lines.map((l) => l.line)).toEqual(
      expect.arrayContaining(["U78", "U79", "701", "705"]),
    );

    const tram = alerts.find((a) => a.title.startsWith("Straßenbahnlinie 709:"));
    expect(tram).toMatchObject({
      kind: "info",
      title: 'Straßenbahnlinie 709: Barrierefreier Ausbau der Haltestelle "Flingern S, Steig 3"',
    });
    expect(tram?.lines).toContainEqual({ line: "709", mode: "tram" });
    // gleiche Linie in beide Richtungen nur einmal
    expect(tram?.lines.filter((l) => l.line === "834")).toHaveLength(1);

    const lift = alerts.find((a) => a.kind === "facility" && a.title.includes("Pempelforter"));
    expect(lift?.stops).toEqual([{ id: "vrr:de:05111:18227", name: "Pempelforter Straße U" }]);

    const blocking = alerts.find((a) => a.kind === "blocking");
    expect(blocking?.text).toMatch(/nicht angefahren/);
    expect(blocking?.text).not.toMatch(/<|&[a-z]+;/);
    // „bis auf Weiteres“ (Jahr 2500) wird zu offenem Ende
    expect(blocking?.validTo).toBeNull();
    expect(blocking?.id).toMatch(/^vrr:[\w-]+:\d+$/);
  });

  it("kennt Gemeindeschlüssel kreisfreier Städte", () => {
    expect(cityName("5111000")).toBe("Düsseldorf");
    expect(cityName("5158032")).toBeNull();
    expect(stopDhid("de:05111:18235:2:5")).toBe("de:05111:18235");
  });
});

describe("API alerts", () => {
  it("liefert Meldungen einer Haltestelle in einer kreisfreien Stadt ohne Zusatzabfrage", async () => {
    const calls = mockUpstream({ XML_ADDINFO_REQUEST: addinfo });
    const res = await get("stop=vrr:de:05111:18227");
    expect(res.status).toBe(200);
    const body = await res.json<AlertsResponse>();
    expect(body).toMatchObject({ area: "5111000", areaName: "Düsseldorf", source: "vrr" });
    expect(body.alerts.length).toBeGreaterThan(0);
    expect(body.alerts.every((a) => a.stops.some((s) => s.id === "vrr:de:05111:18227"))).toBe(true);
    expect(calls.some((u) => u.includes("XML_STOPFINDER_REQUEST"))).toBe(false);
  });

  it("nimmt Linien dazu und vergleicht sie ohne Leerzeichen", async () => {
    mockUpstream({ XML_ADDINFO_REQUEST: addinfo });
    const body = await (
      await get("stop=vrr:de:05111:99998&lines=7%2009,U79")
    ).json<AlertsResponse>();
    expect(body.alerts.some((a) => a.lines.some((l) => l.line === "709"))).toBe(true);
    expect(body.alerts.some((a) => a.lines.some((l) => l.line === "U79"))).toBe(true);
  });

  it("ermittelt die Gemeinde in Kreisen über die Haltestellensuche", async () => {
    const calls = mockUpstream({
      XML_STOPFINDER_REQUEST: {
        locations: [
          {
            id: "de:05158:10401",
            name: "Velbert, An der Wildenburg",
            parent: { id: "placeID:5158032:36", name: "Velbert" },
          },
        ],
      },
      XML_ADDINFO_REQUEST: { infos: { current: [] } },
    });
    const body = await (await get("stop=vrr:de:05158:10401")).json<AlertsResponse>();
    expect(body).toMatchObject({ area: "5158032", areaName: "Velbert", alerts: [] });
    expect(calls.find((u) => u.includes("XML_ADDINFO_REQUEST"))).toContain("filterOMC=5158032");
  });

  it("liefert alle Meldungen einer Gemeinde", async () => {
    mockUpstream({ XML_ADDINFO_REQUEST: addinfo });
    const body = await (await get("area=5111000")).json<AlertsResponse>();
    expect(body.alerts).toHaveLength(26);
  });

  it("liefert für Haltestellen außerhalb des VRR eine leere Liste", async () => {
    const calls = mockUpstream({});
    const body = await (
      await get("stop=transitous:de-DELFI_de:11000:900003201")
    ).json<AlertsResponse>();
    expect(body.alerts).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each(["", "area=511", "stop=abc", "area=5111000&lines=%3Cscript%3E"])(
    "lehnt ungültige Anfragen ab (%s)",
    async (query) => {
      expect((await get(query)).status).toBe(400);
    },
  );
});
