import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STOP_HBF,
  STOP_HHA,
  journey,
  journeyLeg,
  journeyStop,
  journeysResponse,
  renderAt,
  requestUrl,
} from "../test-utils";
import type { JourneysResponse, StopSearchResponse } from "../../shared/api-types";

const HBF = encodeURIComponent(STOP_HBF.id);
const HHA = encodeURIComponent(STOP_HHA.id);
const SEARCH = `/verbindung?von=${HBF}&vonName=D%C3%BCsseldorf+Hbf&nach=${HHA}&nachName=Heinrich-Heine-Allee`;

/** Umstieg mit Fußweg, Verspätung und Gleiswechsel */
const WITH_TRANSFER = journey({
  id: "j2",
  transfers: 1,
  durationMinutes: 65,
  legs: [
    journeyLeg({
      origin: journeyStop({
        ...STOP_HBF,
        plannedDeparture: "2026-11-13T12:20:00Z",
        realtimeDeparture: "2026-11-13T12:23:00Z",
        platform: "5",
        plannedPlatform: "4",
      }),
      line: "S6",
      mode: "suburban",
      direction: "Essen Hbf",
    }),
    journeyLeg({
      kind: "walk",
      line: null,
      mode: null,
      direction: null,
      durationMinutes: 4,
      distanceMeters: 250,
    }),
    journeyLeg({
      line: "706",
      mode: "tram",
      destination: journeyStop({
        ...STOP_HHA,
        plannedArrival: "2026-11-13T13:25:00Z",
        realtimeArrival: null,
      }),
    }),
  ],
});

const CANCELLED = journey({ id: "j3", legs: [journeyLeg({ line: "U75", cancelled: true })] });

function mockApi(
  journeys: (url: URL) => Response | Promise<Response> = () =>
    Response.json(journeysResponse([journey({ id: "j1" }), WITH_TRANSFER, CANCELLED])),
  stops: StopSearchResponse = { stops: [STOP_HBF, STOP_HHA] },
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input);
    if (url.pathname.endsWith("/journeys")) return journeys(url);
    if (url.pathname.endsWith("/stops/nearby")) return Response.json(stops);
    if (url.pathname.endsWith("/stops/search")) return Response.json(stops);
    return new Response(null, { status: 404 });
  });
}

function journeyCalls(fetchMock: ReturnType<typeof mockApi>): URL[] {
  return fetchMock.mock.calls
    .map((call) => requestUrl(call[0]))
    .filter((url) => url.pathname.endsWith("/journeys"));
}

function combobox(name: string) {
  return screen.getByRole("combobox", { name });
}

beforeEach(() => localStorage.clear());
afterEach(() => Reflect.deleteProperty(navigator, "geolocation"));

describe("Verbindungssuche", () => {
  it("ist als Bereich der Navigation erreichbar (#106)", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    expect(within(nav).getByRole("link", { name: "Verbindung" })).toHaveAttribute(
      "href",
      "/abfahrt/verbindung",
    );
  });

  it("fragt ohne Start und Ziel nichts ab", () => {
    const fetchMock = mockApi();
    renderAt("/verbindung");
    expect(screen.getByRole("heading", { name: "Verbindung" })).toBeInTheDocument();
    expect(screen.getByText(/Start und Ziel wählen/)).toBeInTheDocument();
    expect(journeyCalls(fetchMock)).toHaveLength(0);
  });

  it("übernimmt die URL-Parameter und zeigt die Verbindungen kompakt", async () => {
    const fetchMock = mockApi();
    renderAt(`${SEARCH}&zeit=2026-11-13T12:00:00.000Z&ankunft=1`);

    expect(combobox("Von")).toHaveValue("Düsseldorf Hbf");
    expect(combobox("Nach")).toHaveValue("Heinrich-Heine-Allee");
    // Zeit-Chip zeigt Ankunft mit Datum; im Panel ist „Ankunft“ gewählt
    fireEvent.click(screen.getByRole("button", { name: /^Zeitpunkt: An / }));
    expect(screen.getByRole("button", { name: "Ankunft" })).toHaveAttribute("aria-pressed", "true");

    const list = await screen.findByRole("list", { name: "Verbindungen" });
    const [url] = journeyCalls(fetchMock);
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      from: STOP_HBF.id,
      to: STOP_HHA.id,
      when: "2026-11-13T12:00:00.000Z",
      arrive: "1",
    });

    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("13:05");
    expect(rows[0]).toHaveTextContent("13:12");
    expect(rows[0]).toHaveTextContent("7 Min");
    expect(rows[0]).toHaveTextContent("direkt");

    // Verspätung in der Farbe der Abfahrtsliste, Fußweg als Symbol, Linien in Reihenfolge
    expect(rows[1]).toHaveTextContent(/13:20\+3/);
    expect(rows[1]?.querySelector("[data-tone=warning]")).toHaveTextContent("+3");
    expect(rows[1]).toHaveTextContent("1 Std 5 Min");
    expect(rows[1]).toHaveTextContent("1 Umstieg");
    // Balken mit Text für Screenreader, Fußweg dazwischen
    expect(rows[1]).toHaveTextContent("S-Bahn S6, Fußweg, Straßenbahn 706.");
    expect(rows[1]?.textContent?.indexOf("S6")).toBeLessThan(
      rows[1]?.textContent?.indexOf("706") ?? 0,
    );

    expect(rows[2]).toHaveAttribute("data-cancelled", "true");
    expect(rows[2]).toHaveTextContent("fällt aus");

    expect(screen.getByText("Daten: VRR")).toBeInTheDocument();
  });

  it("klappt eine Verbindung auf und zeigt die Abschnitte schlicht", async () => {
    mockApi();
    renderAt(SEARCH);
    const list = await screen.findByRole("list", { name: "Verbindungen" });
    const toggle = within(list).getAllByRole("button")[1]!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const legs = screen.getByRole("list", { name: "Abschnitte" });
    expect(legs).toHaveTextContent("Düsseldorf Hbf · Gleis 5 statt 4");
    expect(legs).toHaveTextContent("Richtung Essen Hbf");
    expect(legs).toHaveTextContent("Fußweg 4 Min · 250 m");
    expect(legs).toHaveTextContent("Heinrich-Heine-Allee · Gleis 1");
    expect(legs).toHaveTextContent("Düsseldorf Hbf · Steig 2");
  });

  it("blättert mit Früher und Später über die Zeitpunkte der Antwort", async () => {
    const fetchMock = mockApi();
    const { router } = renderAt(`${SEARCH}&zeit=2026-11-13T12:00:00.000Z&ankunft=1`);
    await screen.findByRole("list", { name: "Verbindungen" });

    fireEvent.click(screen.getByRole("button", { name: "Später" }));
    await waitFor(() => expect(journeyCalls(fetchMock)).toHaveLength(2));
    const later = journeyCalls(fetchMock)[1];
    expect(later?.searchParams.get("when")).toBe("2026-11-13T12:30:00.000Z");
    expect(later?.searchParams.get("arrive")).toBe("0");
    expect(router.state.location.search).toContain("zeit=2026-11-13T12%3A30%3A00.000Z");
    expect(router.state.location.search).not.toContain("ankunft");

    await waitFor(() => expect(screen.getByRole("button", { name: "Früher" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Früher" }));
    await waitFor(() => expect(journeyCalls(fetchMock)).toHaveLength(3));
    expect(journeyCalls(fetchMock)[2]?.searchParams.get("when")).toBe("2026-11-13T11:40:00.000Z");
  });

  it("blendet Früher/Später aus, wenn die Antwort keine Zeitpunkte liefert", async () => {
    mockApi(() =>
      Response.json(journeysResponse([journey({ id: "j1" })], { earlier: null, later: null })),
    );
    renderAt(SEARCH);
    await screen.findByRole("list", { name: "Verbindungen" });
    expect(screen.queryByRole("button", { name: "Früher" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Später" })).not.toBeInTheDocument();
  });

  it("tauscht Start und Ziel samt Namen", async () => {
    const fetchMock = mockApi();
    const { router } = renderAt(SEARCH);
    await screen.findByRole("list", { name: "Verbindungen" });

    fireEvent.click(screen.getByRole("button", { name: "Start und Ziel tauschen" }));
    expect(combobox("Von")).toHaveValue("Heinrich-Heine-Allee");
    expect(combobox("Nach")).toHaveValue("Düsseldorf Hbf");
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("von")).toBe(STOP_HHA.id);
    expect(params.get("nachName")).toBe("Düsseldorf Hbf");
    await waitFor(() => expect(journeyCalls(fetchMock)).toHaveLength(2));
    expect(journeyCalls(fetchMock)[1]?.searchParams.get("from")).toBe(STOP_HHA.id);
  });

  it("ergänzt fehlende Namen aus der Antwort", async () => {
    mockApi();
    renderAt(`/verbindung?von=${HBF}&nach=${HHA}`);
    await waitFor(() => expect(combobox("Von")).toHaveValue("Düsseldorf Hbf"));
    expect(combobox("Nach")).toHaveValue("Heinrich-Heine-Allee, Düsseldorf");
  });

  it("wählt Haltestellen über die Suche aus, auch per Tastatur", async () => {
    mockApi();
    const { router } = renderAt("/verbindung");

    fireEvent.focus(combobox("Von"));
    fireEvent.change(combobox("Von"), { target: { value: "Düss" } });
    const options = await screen.findByRole("listbox", { name: "Von: Vorschläge" });
    await within(options).findByRole("option", { name: /Düsseldorf Hbf/ });
    fireEvent.click(within(options).getByRole("option", { name: /Düsseldorf Hbf/ }));
    expect(new URLSearchParams(router.state.location.search).get("von")).toBe(STOP_HBF.id);
    expect(combobox("Von")).toHaveValue("Düsseldorf Hbf");

    const nach = combobox("Nach");
    fireEvent.focus(nach);
    fireEvent.change(nach, { target: { value: "Heine" } });
    const nachOptions = screen.getByRole("listbox", { name: "Nach: Vorschläge" });
    await within(nachOptions).findByRole("option", { name: /Heinrich-Heine-Allee/ });
    // Pfeil runter: „Mein Standort“, Hbf, Heinrich-Heine-Allee
    fireEvent.keyDown(nach, { key: "ArrowDown" });
    fireEvent.keyDown(nach, { key: "ArrowDown" });
    fireEvent.keyDown(nach, { key: "ArrowDown" });
    expect(
      within(nachOptions).getByRole("option", { name: /Heinrich-Heine-Allee/ }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(nach, { key: "Enter" });
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("nach")).toBe(STOP_HHA.id);
    expect(params.get("nachName")).toBe("Heinrich-Heine-Allee, Düsseldorf");
    expect(await screen.findByRole("list", { name: "Verbindungen" })).toBeInTheDocument();
  });

  it("nimmt bei „Mein Standort“ die nächste Haltestelle", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn<Geolocation["getCurrentPosition"]>((ok) =>
          ok({
            coords: {
              latitude: 51.2265,
              longitude: 6.7765,
              accuracy: 50,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          }),
        ),
      },
    });
    const fetchMock = mockApi(undefined, {
      stops: [
        { ...STOP_HBF, lat: 51.2199, lon: 6.7944 },
        { ...STOP_HHA, lat: 51.2268, lon: 6.7757 },
      ],
    });
    const { router } = renderAt("/verbindung");

    fireEvent.focus(combobox("Von"));
    fireEvent.click(screen.getByRole("option", { name: /Mein Standort/ }));
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get("von")).toBe(STOP_HHA.id),
    );
    await waitFor(() => expect(combobox("Von")).toHaveValue("Heinrich-Heine-Allee, Düsseldorf"));
    const nearby = fetchMock.mock.calls
      .map((call) => requestUrl(call[0]))
      .find((url) => url.pathname.endsWith("/stops/nearby"));
    expect(nearby?.searchParams.get("lat")).toBe("51.227");
  });

  it("meldet einen nicht freigegebenen Standort", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn<Geolocation["getCurrentPosition"]>((_ok, fail) =>
          fail?.({
            code: 1,
            message: "",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          }),
        ),
      },
    });
    mockApi();
    renderAt("/verbindung");
    fireEvent.focus(combobox("Von"));
    fireEvent.click(screen.getByRole("option", { name: /Mein Standort/ }));
    expect(await screen.findByText(/Standort nicht freigegeben/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "So gibst du ihn frei" })[0]!);
    const help = screen.getByRole("dialog", { name: "Standort freigeben" });
    expect(within(help).getByText(/Safari-Websites/)).toBeInTheDocument();
  });

  it("schaltet auf Ankunft um und setzt dafür einen Zeitpunkt", async () => {
    mockApi();
    const { router } = renderAt(SEARCH);
    fireEvent.click(screen.getByRole("button", { name: "Zeitpunkt: Ab jetzt" }));
    fireEvent.click(screen.getByRole("button", { name: "Ankunft" }));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("ankunft")).toBe("1");
    expect(params.get("zeit")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Jetzt" }));
    const reset = new URLSearchParams(router.state.location.search);
    expect(reset.has("zeit")).toBe(false);
    expect(reset.has("ankunft")).toBe(false);
  });

  it("übernimmt Tag und Uhrzeit in die URL (#102)", () => {
    mockApi();
    const { router } = renderAt(SEARCH);
    const zeit = () => new URLSearchParams(router.state.location.search).get("zeit");
    fireEvent.click(screen.getByRole("button", { name: "Zeitpunkt: Ab jetzt" }));
    fireEvent.click(screen.getByRole("button", { name: "Morgen" }));
    fireEvent.change(screen.getByLabelText("Uhrzeit"), { target: { value: "08:15" } });
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 15);
    expect(zeit()).toBe(expected.toISOString());
    fireEvent.click(screen.getByRole("button", { name: "15 Minuten später" }));
    expect(zeit()).toBe(new Date(expected.getTime() + 15 * 60_000).toISOString());
    fireEvent.click(screen.getByRole("button", { name: "Jetzt" }));
    expect(zeit()).toBeNull();
  });

  it("meldet gleiche Haltestelle für Start und Ziel", () => {
    const fetchMock = mockApi();
    renderAt(`/verbindung?von=${HBF}&nach=${HBF}`);
    expect(screen.getByText("Start und Ziel sind gleich.")).toBeInTheDocument();
    expect(journeyCalls(fetchMock)).toHaveLength(0);
  });

  it("meldet keine Verbindung", async () => {
    mockApi(() => Response.json(journeysResponse([])));
    renderAt(SEARCH);
    expect(await screen.findByText("Keine Verbindung gefunden.")).toBeInTheDocument();
  });

  it.each<[number, string, string]>([
    [404, "stop_not_found", "Start oder Ziel wurde nicht gefunden."],
    [400, "invalid_stop", "Start oder Ziel ist ungültig."],
    [400, "invalid_when", "Der gewählte Zeitpunkt ist ungültig."],
    [502, "upstream_unavailable", "Verbindungen konnten gerade nicht geladen werden."],
  ])("zeigt Fehler %i (%s) verständlich an", async (status, error, message) => {
    let fail = true;
    const fetchMock = mockApi(() =>
      fail
        ? Response.json({ error }, { status })
        : Response.json(journeysResponse([journey({ id: "j1" })]) satisfies JourneysResponse),
    );
    renderAt(SEARCH);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("list", { name: "Verbindungen" })).toBeInTheDocument();
    expect(journeyCalls(fetchMock)).toHaveLength(2);
  });

  it("gibt Route, Fahrrad und Einzelmerkmale weiter (#101)", async () => {
    const fetchMock = mockApi();
    const { router } = renderAt(SEARCH);
    await screen.findByRole("list", { name: "Verbindungen" });
    fireEvent.click(screen.getByRole("button", { name: "Optionen" }));
    const options = screen.getByRole("dialog", { name: "Optionen" });
    fireEvent.click(within(options).getByRole("button", { name: "Wenig Fußweg" }));
    fireEvent.click(within(options).getByRole("button", { name: "Fahrrad mitnehmen" }));
    fireEvent.click(within(options).getByRole("button", { name: "Ohne Treppen" }));
    const search = new URLSearchParams(router.state.location.search);
    expect(search.get("route")).toBe("wenig-fussweg");
    expect(search.get("fahrrad")).toBe("1");
    expect(search.get("ohneTreppen")).toBe("1");
    await waitFor(() => {
      const last = journeyCalls(fetchMock).at(-1);
      expect(last?.searchParams.get("route")).toBe("lessWalking");
      expect(last?.searchParams.get("bike")).toBe("1");
      expect(last?.searchParams.get("noStairs")).toBe("1");
    });
  });

  it("gibt Optionen an die API weiter und zeigt sie kurz an", async () => {
    const fetchMock = mockApi();
    const { router } = renderAt(SEARCH);
    await screen.findByRole("list", { name: "Verbindungen" });

    fireEvent.click(screen.getByRole("button", { name: "Optionen" }));
    const options = screen.getByRole("dialog", { name: "Optionen" });
    fireEvent.click(within(options).getByRole("button", { name: "Bus nutzen" }));
    fireEvent.click(within(options).getByRole("button", { name: "Direkt" }));
    fireEvent.click(within(options).getByRole("button", { name: "Rollstuhl" }));

    expect(router.state.location.search).toContain("ohne=bus");
    expect(router.state.location.search).toContain("umstiege=0");
    expect(router.state.location.search).toContain("barrierefrei=1");
    expect(screen.getByText("ohne Bus · nur direkt · barrierefrei")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Optionen (3 aktiv)" })).toBeInTheDocument();
    await waitFor(() => {
      const last = journeyCalls(fetchMock).at(-1);
      expect(last?.searchParams.get("exclude")).toBe("bus");
      expect(last?.searchParams.get("maxTransfers")).toBe("0");
      expect(last?.searchParams.get("accessible")).toBe("1");
    });

    fireEvent.click(within(options).getByRole("button", { name: "Zurücksetzen" }));
    expect(router.state.location.search).not.toContain("ohne=");
  });

  it("nimmt Adressen und Orte als Start, mit eigenem Symbol", async () => {
    const fetchMock = mockApi(undefined, {
      stops: [
        STOP_HBF,
        {
          id: "geo:51.21780,6.76170",
          name: "Rheinturm",
          place: "Düsseldorf",
          lat: 51.2178,
          lon: 6.7617,
          kind: "poi",
        },
        {
          id: "geo:51.22603,6.77840",
          name: "Königsallee 1",
          place: "Düsseldorf",
          lat: 51.22603,
          lon: 6.7784,
          kind: "address",
        },
      ],
    });
    const { router } = renderAt(`/verbindung?nach=${HHA}&nachName=Heinrich-Heine-Allee`);

    fireEvent.focus(combobox("Von"));
    fireEvent.change(combobox("Von"), { target: { value: "Rhein" } });
    const options = await screen.findByRole("listbox", { name: "Von: Vorschläge" });
    const poi = await within(options).findByRole("option", { name: /Rheinturm/ });
    expect(within(poi).getByLabelText("Ort")).toBeInTheDocument();
    expect(
      within(within(options).getByRole("option", { name: /Königsallee 1/ })).getByLabelText(
        "Adresse",
      ),
    ).toBeInTheDocument();
    const search = fetchMock.mock.calls
      .map((call) => requestUrl(call[0]))
      .find((url) => url.pathname.endsWith("/stops/search"));
    expect(search?.searchParams.get("places")).toBe("1");

    fireEvent.click(poi);
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("von")).toBe("geo:51.21780,6.76170");
    expect(params.get("vonName")).toBe("Rheinturm, Düsseldorf");
    await waitFor(() =>
      expect(journeyCalls(fetchMock).at(-1)?.searchParams.get("from")).toBe("geo:51.21780,6.76170"),
    );
  });
});
