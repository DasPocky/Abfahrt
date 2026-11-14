import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stop } from "../../shared/api-types";
import { renderAt, requestUrl } from "../test-utils";

// MapLibre braucht WebGL, das jsdom nicht hat: die Karte selbst wird ersetzt
vi.mock("@/components/stop-map", () => ({
  StopMap: ({
    stops,
    onViewChange,
    onSelect,
  }: {
    stops: Stop[];
    onViewChange: (view: unknown) => void;
    onSelect: (stop: Stop | null) => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onViewChange({
            bounds: { west: 6.77012, south: 51.22049, east: 6.78488, north: 51.22951 },
            zoom: 15,
          })
        }
      >
        Karte bewegen
      </button>
      <button
        onClick={() =>
          onViewChange({ bounds: { west: 6, south: 51, east: 7, north: 52 }, zoom: 9 })
        }
      >
        Herauszoomen
      </button>
      {stops.map((stop) => (
        <button key={stop.id} onClick={() => onSelect(stop)}>
          Punkt {stop.name}
        </button>
      ))}
    </div>
  ),
}));

const HHA: Stop = {
  id: "vrr:de:05111:18036",
  name: "D-Heinrich-Heine-Allee U",
  lat: 51.2261,
  lon: 6.7767,
};

beforeEach(() => localStorage.clear());

describe("Karte", () => {
  it("lädt Haltestellen im Ausschnitt und verlinkt die Abfahrten", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json({ stops: [HHA] }));
    renderAt("/karte");

    fireEvent.click(await screen.findByRole("button", { name: "Karte bewegen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Punkt D-Heinrich-Heine-Allee U" }));

    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/stops/area");
    expect(url.searchParams.get("min")).toBe("51.220,6.770");
    expect(url.searchParams.get("max")).toBe("51.230,6.785");

    const card = screen.getByRole("group", { name: "D-Heinrich-Heine-Allee U" });
    expect(card).toHaveTextContent("D-Heinrich-Heine-Allee U");
    expect(screen.getByRole("link", { name: /Abfahrten/ })).toHaveAttribute(
      "href",
      "/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18036",
    );
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("group", { name: "D-Heinrich-Heine-Allee U" })).toBeNull();
  });

  it("bittet bei kleinem Zoom ums Heranzoomen und fragt nichts ab", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderAt("/karte");
    fireEvent.click(await screen.findByRole("button", { name: "Herauszoomen" }));
    expect(await screen.findByText(/näher heranzoomen/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zeigt den Quellhinweis für OpenStreetMap und OpenFreeMap", async () => {
    renderAt("/karte");
    expect(await screen.findByRole("link", { name: "OpenStreetMap-Mitwirkende" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByRole("link", { name: "OpenFreeMap" })).toBeInTheDocument();
  });
});

describe("Einstieg auf der Startseite", () => {
  it("verlinkt die Karte", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("link", { name: /auf der Karte/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Karte" })).toBeInTheDocument());
  });
});
