import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StopSearchResponse } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import { dhidOf, groupMapStops, stripCityPrefix } from "../../worker/sources/transitous-map";
import { parseArea } from "../../worker/stops-area";
// Aufgezeichnet am 14.11.2026: v1/map/stops?min=51.220,6.770&max=51.230,6.785 (Düsseldorf)
import duesseldorf from "./fixtures/transitous-map-stops-duesseldorf.json";
// Aufgezeichnet am 14.11.2026: v1/map/stops?min=50.935,6.950&max=50.945,6.965 (Köln)
import koeln from "./fixtures/transitous-map-stops-koeln.json";

const API = `https://endlab.test${API_PREFIX}`;

let ipCounter = 0;
function get(path: string) {
  return exports.default.fetch(`${API}${path}`, {
    headers: { "CF-Connecting-IP": `10.1.0.${++ipCounter}` },
  });
}

function mockTransitous(body: unknown) {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.includes("transitous.org/api/v1/map/stops")) return Response.json(body);
    return new Response("unerwartet", { status: 500 });
  });
  return calls;
}

beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

const params = (min: string, max: string) => new URLSearchParams({ min, max });

describe("Ausschnitt prüfen", () => {
  it("rundet nach außen auf 3 Nachkommastellen", () => {
    expect(parseArea(params("51.22049,6.77012", "51.22951,6.78488"))).toEqual({
      minLat: 51.22,
      minLon: 6.77,
      maxLat: 51.23,
      maxLon: 6.785,
    });
  });

  it("lehnt zu große, verdrehte und kaputte Ausschnitte ab", () => {
    expect(parseArea(params("51.2,6.7", "51.26,6.75"))).toBeNull(); // 0,06° hoch
    expect(parseArea(params("51.2,6.7", "51.22,6.79"))).toBeNull(); // 0,09° breit
    expect(parseArea(params("51.23,6.78", "51.22,6.77"))).toBeNull();
    expect(parseArea(params("51.2,6.7", "abc"))).toBeNull();
    expect(parseArea(params("95,6.7", "96,6.71"))).toBeNull();
    expect(parseArea(new URLSearchParams())).toBeNull();
  });
});

describe("Transitous-Haltestellen zusammenfassen", () => {
  it("liest die DHID auch aus Steigen und anderen Datensätzen", () => {
    expect(dhidOf("de-DELFI_de:05111:18036:8:4")).toBe("de:05111:18036");
    expect(dhidOf("at-Railway-Current-Reference-Data-2027_de:05315:11201:7:79")).toBe(
      "de:05315:11201",
    );
    expect(dhidOf("de-DELFI_de:05315:11201_G")).toBe("de:05315:11201");
    expect(dhidOf("eu-flixbus_49071d1b-9ea7-4ed6-9671-bbfea8856eb9")).toBeNull();
  });

  it("macht im VRR-Gebiet aus Steigen eine VRR-Haltestelle", () => {
    const stops = groupMapStops(duesseldorf);
    const ids = stops.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("vrr:de:05111:"))).toBe(true);
    const hha = stops.find((s) => s.id === "vrr:de:05111:18036");
    expect(hha).toMatchObject({ name: "Heinrich-Heine-Allee U" });
    expect(hha?.lat).toBeCloseTo(51.2261, 2);
    expect(hha?.lon).toBeCloseTo(6.7767, 2);
    // Schadowstraße: Steige mit und ohne Eltern-ID ergeben eine Haltestelle
    expect(stops.filter((s) => s.name === "Schadowstraße U")).toHaveLength(1);
  });

  it("nutzt außerhalb des VRR die Transitous-ID und lässt Dubletten anderer Datensätze weg", () => {
    const stops = groupMapStops(koeln);
    const hbf = stops.filter((s) => /Köln (Hbf|Hauptbahnhof)|Cologne/.test(s.name));
    expect(hbf).toEqual([
      expect.objectContaining({ id: "transitous:de-DELFI_de:05315:11201", name: "Köln Hbf" }),
    ]);
    expect(stops.every((s) => s.id.startsWith("transitous:de-DELFI_de:05315:"))).toBe(true);
    expect(stops.find((s) => s.name === "Köln Neumarkt")?.id).toBe(
      "transitous:de-DELFI_de:05315:11111:2:55",
    );
  });
});

describe("GET stops/area", () => {
  it("liefert Haltestellen im Ausschnitt und fragt Transitous mit gerundetem Ausschnitt", async () => {
    const calls = mockTransitous(duesseldorf);
    const res = await get("stops/area?min=51.22041,6.77013&max=51.22987,6.78466");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const body = await res.json<StopSearchResponse>();
    expect(body.stops.length).toBeGreaterThan(5);
    expect(body.stops[0]).toEqual({
      id: expect.stringMatching(/^vrr:de:05111:/),
      name: expect.any(String),
      lat: expect.any(Number),
      lon: expect.any(Number),
    });
    expect(calls).toEqual([
      "https://api.transitous.org/api/v1/map/stops?min=51.22,6.77&max=51.23,6.785",
    ]);
  });

  it("teilt sich den Cache-Eintrag für denselben gerundeten Ausschnitt", async () => {
    const calls = mockTransitous(koeln);
    await get("stops/area?min=50.9351,6.9501&max=50.9449,6.9649");
    const res = await get("stops/area?min=50.9352,6.9502&max=50.9448,6.9648");
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("lehnt zu große Ausschnitte ab, ohne Transitous zu fragen", async () => {
    const calls = mockTransitous(duesseldorf);
    const res = await get("stops/area?min=51.1,6.7&max=51.3,6.9");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_area" });
    expect(calls).toHaveLength(0);
  });

  it("meldet 502, wenn Transitous nicht antwortet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("kaputt", { status: 503 }));
    const res = await get("stops/area?min=48.1,11.5&max=48.11,11.51");
    expect(res.status).toBe(502);
  });
});

describe("Haltestellennamen", () => {
  it.each([
    ["D-Heinrich-Heine-Allee U", "Heinrich-Heine-Allee U"],
    ["DU-Meiderich Süd Bf", "Meiderich Süd Bf"],
    ["E-Hauptbahnhof", "Hauptbahnhof"],
    ["S-Bahnhof Kalk", "S-Bahnhof Kalk"],
    ["Köln Hbf", "Köln Hbf"],
    ["Bad Neuenahr-Ahrweiler", "Bad Neuenahr-Ahrweiler"],
  ])("entfernt das Städtekürzel: %s", (raw, expected) => {
    expect(stripCityPrefix(raw)).toBe(expected);
  });
});
