import { describe, expect, it, vi } from "vitest";
import {
  alert,
  alertsResponse,
  departuresResponse,
  journey,
  journeysResponse,
  requestUrl,
} from "../test-utils";
import {
  ApiRequestError,
  fetchAlerts,
  fetchDepartures,
  fetchJourneys,
  searchStops,
  shouldRetry,
  stopPath,
} from "./api";

describe("searchStops", () => {
  it("fragt den Suchendpunkt mit kodiertem Suchtext ab", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ stops: [] }));
    await expect(searchStops("Düsseldorf Hbf")).resolves.toEqual({ stops: [] });
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/stops/search");
    expect(url.searchParams.get("q")).toBe("Düsseldorf Hbf");
  });
});

describe("fetchAlerts", () => {
  it("fragt nach Haltestelle mit Linien oder nach Gemeinde", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(alertsResponse([alert({ id: "a" })])));
    const res = await fetchAlerts({ stop: "vrr:de:05111:18235", lines: ["U79", "706"] });
    expect(res.alerts).toHaveLength(1);
    let url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/alerts");
    expect(url.searchParams.get("stop")).toBe("vrr:de:05111:18235");
    expect(url.searchParams.get("lines")).toBe("U79,706");

    await fetchAlerts({ area: "5111000" });
    url = requestUrl(fetchMock.mock.calls[1]?.[0]);
    expect(url.searchParams.get("area")).toBe("5111000");
    expect(url.searchParams.has("stop")).toBe(false);
    expect(url.searchParams.has("lines")).toBe(false);
  });

  it("lehnt kaputte Meldungen ab", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ...alertsResponse([]),
        alerts: [{ ...alert({ id: "a" }), kind: "unbekannt" }],
      }),
    );
    await expect(fetchAlerts({ area: "5111000" })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});

describe("fetchDepartures", () => {
  it("übergibt Haltestelle und optional den Zeitpunkt", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(departuresResponse([])));
    await fetchDepartures("vrr:de:05111:18235", undefined, "2026-11-13T12:00:00Z");
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/departures");
    expect(url.searchParams.get("stop")).toBe("vrr:de:05111:18235");
    expect(url.searchParams.get("when")).toBe("2026-11-13T12:00:00Z");
  });

  it("wirft ApiRequestError mit Daten aus ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "not_found", message: "Haltestelle unbekannt" }, { status: 404 }),
    );
    const error = await fetchDepartures("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 404,
      code: "not_found",
      message: "Haltestelle unbekannt",
    });
  });

  it("wirft ApiRequestError auch ohne JSON-Antwort", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
    await expect(fetchDepartures("x")).rejects.toMatchObject({ status: 502, code: "http_error" });
  });
});

describe("fetchJourneys", () => {
  it("übergibt Start, Ziel, Zeitpunkt und Ankunft", async () => {
    const body = journeysResponse([journey({ id: "j1" })]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body));
    await expect(
      fetchJourneys({ from: "vrr:a", to: "vrr:b", when: "2026-11-13T12:00:00Z", arrive: true }),
    ).resolves.toEqual(body);
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/journeys");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "vrr:a",
      to: "vrr:b",
      when: "2026-11-13T12:00:00Z",
      arrive: "1",
    });
  });

  it("lässt den Zeitpunkt ohne Angabe weg und fragt nach Abfahrt", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(journeysResponse([])));
    await fetchJourneys({ from: "vrr:a", to: "vrr:b" });
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.searchParams.has("when")).toBe(false);
    expect(url.searchParams.get("arrive")).toBe("0");
  });

  it("lehnt Antworten ohne Früher/Später-Angaben ab", async () => {
    const { earlier: _earlier, ...rest } = journeysResponse([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(rest));
    await expect(fetchJourneys({ from: "a", to: "b" })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});

describe("Antwortprüfung", () => {
  it("lehnt Antworten ab, die nicht zum Vertrag passen", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ departures: "kaputt" }));
    await expect(fetchDepartures("x")).rejects.toMatchObject({ code: "invalid_response" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>"));
    await expect(searchStops("Düsseldorf")).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("stopPath", () => {
  it("kodiert die Haltestellen-ID", () => {
    expect(stopPath("vrr:de:05111:18235")).toBe("/haltestelle/vrr%3Ade%3A05111%3A18235");
    expect(stopPath("transitous:a/b c")).toBe("/haltestelle/transitous%3Aa%2Fb%20c");
  });
});

describe("shouldRetry", () => {
  it("wiederholt keine Client-Fehler", () => {
    expect(shouldRetry(0, new ApiRequestError(400, "bad_request"))).toBe(false);
    expect(shouldRetry(0, new ApiRequestError(404, "not_found"))).toBe(false);
  });

  it("wiederholt Server- und Netzfehler höchstens zweimal", () => {
    expect(shouldRetry(0, new ApiRequestError(502, "upstream"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, new TypeError("Failed to fetch"))).toBe(false);
  });
});
