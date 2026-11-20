import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeFavorites, toFavorite } from "@/lib/favorites";
import { EMPTY_FILTER } from "@/lib/filters";
import {
  alert,
  alertsResponse,
  departure,
  departuresResponse,
  renderAt,
  requestUrl,
  STOP_HBF,
} from "../test-utils";

const FLINGERN = { id: "vrr:de:05111:18560", name: "Flingern S", place: "Düsseldorf" };

const TRAM = alert({ id: "tram" });
const LIFT = alert({
  id: "lift",
  kind: "facility",
  title: "Haltestelle Düsseldorf Hbf: Aufzug außer Betrieb.",
  text: "",
  url: null,
  validFrom: "2026-11-10T06:00:00Z",
  validTo: null,
  lines: [],
  stops: [{ id: STOP_HBF.id, name: STOP_HBF.name }],
});
const BUS = alert({
  id: "bus",
  kind: "info",
  severity: "low",
  title: "Buslinie 834: Umleitung wegen Weihnachtsmarkt",
  lines: [{ line: "834", mode: "bus" }],
  stops: [],
});

function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index];
  if (!element) throw new Error(`Element ${index} fehlt`);
  return element;
}

type Handler = (url: URL) => unknown;

function mockApi(handler: Handler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input);
    return Response.json(handler(url));
  });
}

function alertCalls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input]) => requestUrl(input))
    .filter((url) => url.pathname.endsWith("/alerts"))
    .map((url) => url.search);
}

beforeEach(() => {
  localStorage.clear();
  // nur die Uhr fest, Timer laufen normal (TanStack Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Störungsübersicht", () => {
  it("zeigt ohne Favoriten und Standort Düsseldorf, Sperrungen zuerst", async () => {
    const fetchMock = mockApi(() => alertsResponse([BUS, LIFT, TRAM]));
    renderAt("/stoerungen");

    const list = await screen.findByRole("list", { name: "Störungen" });
    expect(screen.getByRole("heading", { name: "Störungen in Düsseldorf" })).toBeInTheDocument();
    expect(alertCalls(fetchMock)).toEqual(["?area=5111000"]);
    const rows = within(list).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Straßenbahnlinie 709"),
      expect.stringContaining("Aufzug außer Betrieb"),
      expect.stringContaining("Buslinie 834"),
    ]);
    expect(within(nth(rows, 0)).getByText("bis 21.11.")).toBeInTheDocument();
    expect(
      within(nth(rows, 1)).getByRole("img", { name: "Aufzug/Rolltreppe" }),
    ).toBeInTheDocument();
  });

  it("filtert nach Verkehrsmittel", async () => {
    mockApi(() => alertsResponse([BUS, LIFT, TRAM]));
    renderAt("/stoerungen");
    const list = await screen.findByRole("list", { name: "Störungen" });

    const chips = screen.getByRole("group", { name: "Nach Verkehrsmittel filtern" });
    expect(
      within(chips)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Alle", "Tram", "Bus"]);
    fireEvent.click(within(chips).getByRole("button", { name: "Bus" }));
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(chips).getByRole("button", { name: "Bus" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("nimmt die Gemeinde der ersten Favoriten-Haltestelle und zeigt ihre Meldungen zuerst", async () => {
    localStorage.setItem("abfahrt:favorites", serializeFavorites([toFavorite(FLINGERN)]));
    const fetchMock = mockApi((url) =>
      url.searchParams.has("stop") ? alertsResponse([TRAM]) : alertsResponse([LIFT, TRAM]),
    );
    renderAt("/stoerungen");

    const list = await screen.findByRole("list", { name: "Störungen" });
    expect(alertCalls(fetchMock)).toEqual([
      `?stop=${encodeURIComponent(FLINGERN.id)}`,
      "?area=5111000",
    ]);
    expect(screen.getByText(/über Flingern S \(Favorit\)/)).toBeInTheDocument();
    const first = nth(within(list).getAllByRole("button"), 0);
    expect(within(first).getByRole("img", { name: "Betrifft Favorit" })).toBeInTheDocument();
    expect(first.textContent).toContain("Straßenbahnlinie 709");
  });

  it("öffnet den vollen Text mit Link in neuem Fenster", async () => {
    mockApi(() => alertsResponse([TRAM]));
    renderAt("/stoerungen");
    const list = await screen.findByRole("list", { name: "Störungen" });

    fireEvent.click(within(list).getByRole("button"));
    const dialog = screen.getByRole("dialog", { name: TRAM.title });
    expect(within(dialog).getByText(TRAM.text)).toBeVisible();
    expect(within(dialog).getByText("Haltestelle: Flingern S")).toBeInTheDocument();
    const link = within(dialog).getByRole("link", { name: /Mehr beim Verkehrsverbund/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("meldet, wenn nichts gemeldet ist", async () => {
    mockApi(() => alertsResponse([]));
    renderAt("/stoerungen");
    expect(await screen.findByText("Keine Störungen gemeldet.")).toBeInTheDocument();
  });

  it("zeigt einen Fehler mit erneutem Versuch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "upstream_unavailable" }, { status: 502 }),
    );
    renderAt("/stoerungen");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Störungen konnten nicht geladen werden.",
    );
  });
});

describe("Hinweis auf der Startseite", () => {
  it("zählt Störungen bei Favoriten und verlinkt die Übersicht", async () => {
    localStorage.setItem(
      "abfahrt:favorites",
      serializeFavorites([
        toFavorite(STOP_HBF, { ...EMPTY_FILTER, lines: ["U79"] }),
        toFavorite({ id: "transitous:x", name: "Woanders" }),
      ]),
    );
    const fetchMock = mockApi((url) =>
      url.pathname.endsWith("/alerts")
        ? alertsResponse([LIFT, alert({ id: "u79", lines: [{ line: "U 79", mode: "subway" }] })])
        : departuresResponse([]),
    );
    renderAt("/");

    const link = await screen.findByRole("link", { name: /2 Störungen bei deinen Favoriten/ });
    expect(link).toHaveAttribute("href", "/stoerungen");
    expect(alertCalls(fetchMock)).toEqual([`?stop=${encodeURIComponent(STOP_HBF.id)}&lines=U79`]);
  });

  it("bietet den Einstieg zur Übersicht unter der Suche", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Störungen" })).toHaveAttribute("href", "/stoerungen");
  });
});

describe("Hinweis auf der Haltestellenseite", () => {
  it("zeigt Meldungen der Haltestelle, aber nicht doppelt zu den Abfahrts-Hinweisen", async () => {
    const shared = "Haltestelle Düsseldorf Hbf: Rolltreppe zu Gleis 2 außer Betrieb.";
    mockApi((url) =>
      url.pathname.endsWith("/alerts")
        ? alertsResponse([
            LIFT,
            alert({ id: "dup", kind: "facility", title: shared, text: "", lines: [] }),
          ])
        : departuresResponse([
            departure({
              id: "a",
              plannedTime: new Date(Date.now() + 60_000).toISOString(),
              realtimeTime: null,
              notices: [shared],
            }),
            departure({
              id: "b",
              plannedTime: new Date(Date.now() + 120_000).toISOString(),
              realtimeTime: null,
              notices: [shared],
            }),
          ]),
    );
    renderAt(`/haltestelle/${encodeURIComponent(STOP_HBF.id)}`);

    // Aufzüge/Rolltreppen in eigener Zeile, ohne Haltestellennamen im Titel (#70)
    const banner = await screen.findByRole("button", {
      name: /2 Aufzüge\/Rolltreppen: Aufzug außer Betrieb/,
    });
    // der gleiche Text steht nicht zusätzlich als Hinweis an den Abfahrten
    expect(screen.queryByRole("button", { name: /Hinweis für diese Haltestelle/ })).toBeNull();
    fireEvent.click(banner);
    const dialog = screen.getByRole("dialog", {
      name: "Aufzüge und Rolltreppen an dieser Haltestelle",
    });
    expect(within(dialog).getByText("Rolltreppe zu Gleis 2 außer Betrieb")).toBeInTheDocument();
  });
});
