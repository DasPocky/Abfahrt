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
import { DEFAULT_JOURNEY_OPTIONS } from "../../shared/journey-options";
import { journeySignature, SAVED_TRIP_KEY } from "@/lib/saved-trip";
import type { Journey } from "../../shared/api-types";

function inMinutes(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function upcoming(id: string, line = "U79"): Journey {
  return journey({
    id,
    legs: [
      journeyLeg({
        line,
        origin: journeyStop({ ...STOP_HBF, plannedDeparture: inMinutes(10), platform: "2" }),
        destination: journeyStop({ ...STOP_HHA, plannedArrival: inMinutes(17), platform: "1" }),
      }),
    ],
  });
}

function mockJourneys(journeys: Journey[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input);
    if (url.pathname.endsWith("/journeys")) return Response.json(journeysResponse(journeys));
    return new Response(null, { status: 404 });
  });
}

function store(j: Journey) {
  localStorage.setItem(
    SAVED_TRIP_KEY,
    JSON.stringify({
      version: 1,
      from: { id: STOP_HBF.id, name: "Düsseldorf Hbf" },
      to: { id: STOP_HHA.id, name: "Heinrich-Heine-Allee" },
      options: DEFAULT_JOURNEY_OPTIONS,
      signature: journeySignature(j),
      journey: j,
      savedAt: new Date().toISOString(),
    }),
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Live-Begleitung", () => {
  it("merkt eine Verbindung aus der Suche und zeigt den nächsten Schritt", async () => {
    const trip = upcoming("j1");
    const fetchMock = mockJourneys([trip]);
    const { router } = renderAt(
      `/verbindung?von=${encodeURIComponent(STOP_HBF.id)}&vonName=D%C3%BCsseldorf+Hbf&nach=${encodeURIComponent(STOP_HHA.id)}&nachName=Heinrich-Heine-Allee`,
    );
    const list = await screen.findByRole("list", { name: "Verbindungen" });
    fireEvent.click(within(list).getAllByRole("button", { expanded: false })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Merken & live verfolgen/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/abfahrt/fahrt"));
    expect(localStorage.getItem(SAVED_TRIP_KEY)).toContain(journeySignature(trip));
    const status = await screen.findByText("U79 ab Düsseldorf Hbf · Steig 2");
    expect(status).toBeInTheDocument();
    expect(screen.getByText(/^Abfahrt in (9|10) Min$/)).toBeInTheDocument();
    // Live-Abfrage ab der geplanten Abfahrt der gemerkten Verbindung
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => requestUrl(c[0]));
      expect(
        calls.some((u) => u.searchParams.get("when") === trip.legs[0]?.origin.plannedDeparture),
      ).toBe(true);
    });
  });

  it("warnt, wenn die Verbindung nicht mehr im Fahrplan ist, und bietet Alternativen", async () => {
    store(upcoming("alt"));
    mockJourneys([upcoming("andere", "U75")]);
    renderAt("/fahrt");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("nicht mehr im Fahrplan");
    expect(within(alert).getByRole("link", { name: /Alternativen suchen/ })).toHaveAttribute(
      "href",
      expect.stringContaining(`/abfahrt/verbindung?von=${encodeURIComponent(STOP_HBF.id)}`),
    );
  });

  it("zeigt die gemerkte Fahrt auf der Startseite und lässt sich beenden", async () => {
    store(upcoming("j1"));
    mockJourneys([upcoming("j1")]);
    const { router } = renderAt("/");
    const card = screen.getByRole("link", { name: /Unterwegs nach Heinrich-Heine-Allee/ });
    expect(card).toHaveAttribute("href", "/abfahrt/fahrt");

    fireEvent.click(card);
    fireEvent.click(await screen.findByRole("button", { name: /Begleitung beenden/ }));
    expect(localStorage.getItem(SAVED_TRIP_KEY)).toBeNull();
    expect(router.state.location.pathname).toMatch(/^\/abfahrt\/?$/);
    expect(screen.queryByRole("link", { name: /Unterwegs nach/ })).toBeNull();
  });

  it("erklärt die Seite, wenn nichts gemerkt ist", () => {
    renderAt("/fahrt");
    expect(screen.getByRole("heading", { name: "Keine gemerkte Verbindung" })).toBeInTheDocument();
  });
});
