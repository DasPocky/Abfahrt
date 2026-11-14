import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeFavorites, toFavorite } from "@/lib/favorites";
import { EMPTY_FILTER } from "@/lib/filters";
import { departure, departuresResponse, renderAt, requestUrl, STOP_HBF } from "../test-utils";

const HHA = { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U", place: "Düsseldorf" };

function inMinutes(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function mixedDepartures(prefix: string) {
  return Array.from({ length: 8 }, (_, i) =>
    departure({
      id: `${prefix}-${i}`,
      line: i % 2 === 0 ? `S${i}` : `U7${i}`,
      mode: i % 2 === 0 ? "suburban" : "subway",
      plannedTime: inMinutes(i + 1),
      realtimeTime: inMinutes(i + 1),
    }),
  );
}

/** Titel der Favoriten (erste Zeile im Link) */
function favoriteLinks() {
  return within(screen.getByRole("list", { name: "Favoriten" }))
    .getAllByRole("link")
    .map((l) => l.querySelector("span > span")?.textContent);
}

beforeEach(() => localStorage.clear());

describe("Favoriten auf der Startseite", () => {
  it("zeigt einen Hinweis, solange es keine Favoriten gibt", () => {
    renderAt("/");
    expect(screen.getByText(/Noch keine Favoriten/)).toBeInTheDocument();
  });

  it("zeigt je Favorit die nächsten Abfahrten, gefiltert nach der gespeicherten Ansicht", async () => {
    localStorage.setItem(
      "abfahrt:favorites",
      serializeFavorites([toFavorite(STOP_HBF, { ...EMPTY_FILTER, modes: ["suburban"] })]),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const stop = requestUrl(input).searchParams.get("stop") ?? "";
      return Response.json(departuresResponse(mixedDepartures(stop)));
    });
    renderAt("/");

    const list = screen.getByRole("list", { name: "Favoriten" });
    expect(within(list).getByRole("link", { name: /Düsseldorf Hbf/ })).toHaveAttribute(
      "href",
      "/abfahrt/haltestelle/vrr%3Ade%3A05111%3A18235?vm=suburban",
    );
    expect(within(list).getByText("Düsseldorf · S-Bahn")).toBeInTheDocument();
    const deps = await within(list).findByRole("list", { name: "Abfahrten" });
    const rows = within(deps).getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.textContent).toMatch(/S\d/);
  });

  it("verschiebt, benennt um und entfernt Favoriten", () => {
    localStorage.setItem(
      "abfahrt:favorites",
      serializeFavorites([toFavorite(STOP_HBF), toFavorite(HHA)]),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(departuresResponse([])));
    renderAt("/");

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    fireEvent.click(screen.getByRole("button", { name: "Heinrich-Heine-Allee U nach oben" }));
    expect(favoriteLinks()).toEqual(["Heinrich-Heine-Allee U", "Düsseldorf Hbf"]);

    fireEvent.click(screen.getByRole("button", { name: "Düsseldorf Hbf umbenennen" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Eigener Name" }), {
      target: { value: "Arbeit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Namen speichern" }));
    expect(favoriteLinks()).toEqual(["Heinrich-Heine-Allee U", "Arbeit"]);

    fireEvent.click(screen.getByRole("button", { name: "Arbeit aus Favoriten entfernen" }));
    expect(favoriteLinks()).toEqual(["Heinrich-Heine-Allee U"]);
  });
});

describe("Haltestellenseite: Filter und Stern", () => {
  it("filtert per Chip, schreibt den Filter in die URL und speichert die Ansicht", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(departuresResponse(mixedDepartures("x"))),
    );
    const { router } = renderAt(`/haltestelle/${encodeURIComponent(STOP_HBF.id)}`);

    const chips = await screen.findByRole("group", { name: "Verkehrsmittel filtern" });
    fireEvent.click(within(chips).getByRole("button", { name: /S-Bahn/ }));
    expect(router.state.location.search).toBe("?vm=suburban");
    const rows = within(screen.getByRole("list", { name: "Abfahrten" })).getAllByRole("listitem");
    for (const row of rows) expect(row.textContent).toMatch(/S\d/);
    expect(screen.getByText("Ansicht: S-Bahn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ansicht zu Favoriten hinzufügen" }));
    expect(localStorage.getItem("abfahrt:favorites")).toContain("vm=suburban");
    // Ohne Filter ist es eine andere Ansicht, also noch kein Favorit
    fireEvent.click(within(chips).getByRole("button", { name: "Alle" }));
    expect(
      screen.getByRole("button", { name: "Haltestelle zu Favoriten hinzufügen" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("bietet Zurücksetzen an, wenn der Filter alles ausblendet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(departuresResponse(mixedDepartures("x"))),
    );
    renderAt(`/haltestelle/${encodeURIComponent(STOP_HBF.id)}?gleis=99`);
    fireEvent.click(await screen.findByRole("button", { name: "Filter zurücksetzen" }));
    expect(await screen.findByRole("list", { name: "Abfahrten" })).toBeInTheDocument();
  });
});
