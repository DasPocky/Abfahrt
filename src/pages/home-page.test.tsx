import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeFavorites } from "@/lib/favorites";
import { departure, departuresResponse, renderAt, requestUrl, STOP_HBF } from "../test-utils";

const HHA = { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U", place: "Düsseldorf" };

function inMinutes(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function names() {
  return within(screen.getByRole("list", { name: "Favoriten" }))
    .getAllByRole("link")
    .map((l) => l.textContent);
}

beforeEach(() => localStorage.clear());

describe("Favoriten", () => {
  it("zeigt einen Hinweis, solange es keine Favoriten gibt", () => {
    renderAt("/");
    expect(screen.getByText(/Noch keine Favoriten/)).toBeInTheDocument();
  });

  it("zeigt Favoriten mit den nächsten Abfahrten", async () => {
    localStorage.setItem("abfahrt:favorites", serializeFavorites([STOP_HBF, HHA]));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const stop = requestUrl(input).searchParams.get("stop");
      const deps = Array.from({ length: 6 }, (_, i) =>
        departure({
          id: `${stop}-${i}`,
          line: `U7${i}`,
          plannedTime: inMinutes(i + 1),
          realtimeTime: inMinutes(i + 1),
        }),
      );
      return Response.json(departuresResponse(deps));
    });
    renderAt("/");

    const list = screen.getByRole("list", { name: "Favoriten" });
    const cards = within(list).getAllByRole("listitem", { name: undefined });
    expect(within(list).getByRole("link", { name: /Düsseldorf Hbf/ })).toHaveAttribute(
      "href",
      "/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18235",
    );
    expect(cards.length).toBeGreaterThan(0);
    const firstDepartures = await within(list).findAllByRole("list", { name: "Abfahrten" });
    expect(within(firstDepartures[0]!).getAllByRole("listitem")).toHaveLength(4);
  });

  it("verschiebt und entfernt Favoriten", async () => {
    localStorage.setItem("abfahrt:favorites", serializeFavorites([STOP_HBF, HHA]));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(departuresResponse([])));
    renderAt("/");

    fireEvent.click(screen.getByRole("button", { name: "Heinrich-Heine-Allee U nach oben" }));
    expect(names()).toEqual(["Heinrich-Heine-Allee U", "Düsseldorf Hbf"]);

    fireEvent.click(screen.getByRole("button", { name: "Düsseldorf Hbf aus Favoriten entfernen" }));
    expect(names()).toEqual(["Heinrich-Heine-Allee U"]);
    expect(localStorage.getItem("abfahrt:favorites")).toContain("18036");
  });
});

describe("Stern auf der Haltestellenseite", () => {
  it("speichert und entfernt die Haltestelle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(departuresResponse([])));
    renderAt(`/haltestelle/${encodeURIComponent(STOP_HBF.id)}`);

    const star = await screen.findByRole("button", { name: "Zu Favoriten hinzufügen" });
    fireEvent.click(star);
    expect(screen.getByRole("button", { name: "Aus Favoriten entfernen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("abfahrt:favorites")).toContain("Düsseldorf Hbf");

    fireEvent.click(screen.getByRole("button", { name: "Aus Favoriten entfernen" }));
    expect(localStorage.getItem("abfahrt:favorites")).not.toContain("Düsseldorf Hbf");
  });
});
