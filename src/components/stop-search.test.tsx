import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STOP_HBF, renderAt, requestUrl } from "../test-utils";
import type { StopSearchResponse } from "../../shared/api-types";

const RESULTS: StopSearchResponse = {
  stops: [
    STOP_HBF,
    { id: "vrr:de:05111:18036", name: "Düsseldorf Heinrich-Heine-Allee", place: "Düsseldorf" },
  ],
};

function input() {
  return screen.getByRole("searchbox", { name: "Haltestelle suchen" });
}

describe("StopSearch", () => {
  it("sucht ab zwei Zeichen mit Verzögerung und zeigt Treffer als Links", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(RESULTS));
    renderAt("/");

    fireEvent.change(input(), { target: { value: "D" } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: "Dü" } });
    fireEvent.change(input(), { target: { value: "Düss" } });
    expect(screen.getByRole("status")).toHaveTextContent("Suche läuft");

    const results = await screen.findByRole("list", { name: "Suchergebnisse" });
    const link = await within(results).findByRole("link", { name: /Düsseldorf Hbf/ });
    expect(link).toHaveAttribute("href", "/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18235");
    expect(within(results).getAllByRole("link")).toHaveLength(2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/stops/search");
    expect(url.searchParams.get("q")).toBe("Düss");
  });

  it("meldet keine Treffer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ stops: [] }));
    renderAt("/");
    fireEvent.change(input(), { target: { value: "xyzzy" } });
    expect(await screen.findByText("Keine Haltestelle gefunden.")).toBeInTheDocument();
  });

  it("meldet Fehler der Suche", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "upstream_error" }, { status: 502 }),
    );
    renderAt("/");
    fireEvent.change(input(), { target: { value: "Düsseldorf" } });
    expect(await screen.findByText(/Suche gerade nicht möglich/)).toBeInTheDocument();
  });

  it("ist per Tastatur bedienbar", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(RESULTS));
    renderAt("/");
    fireEvent.change(input(), { target: { value: "Düss" } });
    const links = await screen.findAllByRole("link", { name: /Düsseldorf/ });

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(links[0]!, { key: "ArrowDown" });
    expect(links[1]).toHaveFocus();
    fireEvent.keyDown(links[1]!, { key: "ArrowDown" });
    expect(links[1]).toHaveFocus();
    fireEvent.keyDown(links[1]!, { key: "ArrowUp" });
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(links[0]!, { key: "ArrowUp" });
    expect(input()).toHaveFocus();
  });

  it("öffnet mit Enter den ersten Treffer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((request) => {
      const url = requestUrl(request);
      if (url.pathname.endsWith("/stops/search")) return Promise.resolve(Response.json(RESULTS));
      return new Promise(() => {});
    });
    const { router } = renderAt("/");
    fireEvent.change(input(), { target: { value: "Düss" } });
    await screen.findAllByRole("link", { name: /Düsseldorf/ });

    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18235"),
    );
    expect(await screen.findByRole("heading", { name: "Düsseldorf Hbf" })).toBeInTheDocument();
    const departuresCall = fetchMock.mock.calls
      .map((call) => requestUrl(call[0]))
      .find((url) => url.pathname.endsWith("/departures"));
    expect(departuresCall?.searchParams.get("stop")).toBe("vrr:de:05111:18235");
  });
});
