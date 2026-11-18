import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DepartureList } from "@/components/departure-list";
import type { JourneyStop, TripResponse } from "../../shared/api-types";
import { departure, renderAt, requestUrl } from "../test-utils";

const REF = "efa|vrr|rbg:70076: :H:j26|de:05111:18036:8:4|462|202611181221";
const MIN = 60_000;

function at(offsetMin: number): string {
  return new Date(Date.now() + offsetMin * MIN).toISOString();
}

function stop(id: string, name: string, offsetMin: number, delay = 0): JourneyStop {
  return {
    id,
    name,
    plannedArrival: at(offsetMin),
    realtimeArrival: at(offsetMin + delay),
    plannedDeparture: at(offsetMin),
    realtimeDeparture: at(offsetMin + delay),
    platform: "2",
    plannedPlatform: null,
    cancelled: false,
  };
}

function trip(): TripResponse {
  return {
    source: "vrr",
    generatedAt: new Date().toISOString(),
    leg: {
      kind: "transit",
      origin: stop("vrr:de:05114:21001", "Krefeld Rheinstraße", -20),
      intermediateStops: [
        stop("vrr:de:05162:18142", "Meerbusch Bovert", -5),
        stop("vrr:de:05111:18036", "Heinrich-Heine-Allee U", 4, 2),
      ],
      destination: { ...stop("vrr:de:05111:18266", "Holthausen", 20), plannedDeparture: null },
      durationMinutes: 40,
      distanceMeters: null,
      line: "U76",
      mode: "subway",
      direction: "Holthausen",
      lineColor: "0063af",
      lineTextColor: "ffffff",
      cancelled: false,
      notices: ["Aufzug am Hbf außer Betrieb"],
      path: null,
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Fahrtverlauf (#120)", () => {
  it("zeigt alle Halte, die eigene Haltestelle und wo die Bahn gerade ist", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(trip()));
    renderAt(`/verlauf?ref=${encodeURIComponent(REF)}&von=vrr%3Ade%3A05111%3A18036`);

    const list = await screen.findByRole("list", { name: "Halte" });
    expect(screen.getByRole("heading", { name: /U76.*nach Holthausen/ })).toBeInTheDocument();
    const names = within(list)
      .getAllByRole("link")
      .map((l) => l.textContent);
    expect(names).toEqual([
      "Krefeld Rheinstraße",
      "Meerbusch Bovert",
      "Heinrich-Heine-Allee U",
      "Holthausen",
    ]);
    expect(list.querySelector("[aria-current=location]")).toHaveTextContent(
      "Heinrich-Heine-Allee U",
    );
    // zwischen Meerbusch Bovert (abgefahren) und Heinrich-Heine-Allee
    expect(
      within(list).getByText(/U76 ist gerade zwischen Meerbusch Bovert und Heinrich-Heine-Allee U/),
    ).toBeInTheDocument();
    expect(screen.getByText("Unterwegs", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aufzug am Hbf/ })).toBeInTheDocument();

    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/trip");
    expect(url.searchParams.get("ref")).toBe(REF);
  });

  it("meldet eine Fahrt, die es nicht mehr gibt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "trip_not_found" }, { status: 404 }),
    );
    renderAt(`/verlauf?ref=${encodeURIComponent(REF)}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht mehr im Fahrplan");
  });

  it("macht Abfahrten mit Verweis zum Link auf den Fahrtverlauf", () => {
    render(
      <MemoryRouter>
        <DepartureList
          now={new Date("2026-11-13T12:00:00Z")}
          stopId="vrr:de:05111:18036"
          departures={[
            departure({ id: "a", line: "U76", direction: "Holthausen", tripRef: REF }),
            departure({ id: "b", line: "707", direction: "Unterrath" }),
          ]}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "U76 nach Holthausen: Fahrtverlauf" });
    const href = new URL(link.getAttribute("href")!, "https://x");
    expect(href.pathname).toBe("/verlauf");
    expect(href.searchParams.get("ref")).toBe(REF);
    expect(href.searchParams.get("von")).toBe("vrr:de:05111:18036");
    // ohne Verweis kein Link
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.click(link);
  });

  it("öffnet den Verlauf aus der Abfahrtsliste der Haltestelle", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith("/departures")) {
        return Response.json({
          stop: { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U" },
          departures: [
            departure({
              id: "a",
              line: "U76",
              direction: "Holthausen",
              plannedTime: at(4),
              realtimeTime: at(6),
              tripRef: REF,
            }),
          ],
          source: "vrr",
          generatedAt: new Date().toISOString(),
        });
      }
      if (url.pathname.endsWith("/trip")) return Response.json(trip());
      return Response.json({ alerts: [] });
    });
    const { router } = renderAt("/haltestelle/vrr%3Ade%3A05111%3A18036");
    fireEvent.click(await screen.findByRole("link", { name: /U76 nach Holthausen: Fahrtverlauf/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/abfahrt/verlauf"));
    expect(await screen.findByRole("list", { name: "Halte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeInTheDocument();
  });
});
