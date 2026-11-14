import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { departure, departuresResponse, renderAt, requestUrl } from "./test-utils";

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zeigt auf der Startseite die Haltestellensuche", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Abfahrt – Startseite" })).toHaveAttribute(
      "href",
      "/abfahrt",
    );
    expect(screen.getByRole("heading", { name: "Abfahrten suchen" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Haltestelle suchen" })).toBeInTheDocument();
  });

  it("zeigt die Abfahrten einer Haltestelle mit Stand und VRR-Quellhinweis", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-13T12:00:00Z") });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        departuresResponse([
          departure({
            id: "1",
            line: "U79",
            direction: "Duisburg Meiderich Süd Bf",
            plannedTime: "2026-11-13T12:03:00Z",
            realtimeTime: "2026-11-13T12:05:00Z",
          }),
        ]),
      ),
    );

    renderAt("/haltestelle/vrr%3Ade%3A05111%3A18235");

    expect(await screen.findByRole("heading", { name: "Düsseldorf Hbf" })).toBeInTheDocument();
    expect(screen.getByText("Duisburg Meiderich Süd Bf")).toBeInTheDocument();
    expect(screen.getByLabelText("in 5 Min")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText(/^Stand/)).toHaveTextContent("Stand 13:00:00");
    expect(screen.getByRole("link", { name: "Zurück zur Suche" })).toHaveAttribute(
      "href",
      "/abfahrt",
    );
    expect(
      screen.getByText(/Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt/),
    ).toBeInTheDocument();
    expect(screen.getByText("Daten: VRR")).toBeInTheDocument();

    const url = requestUrl(fetchMock.mock.calls[0]?.[0]);
    expect(url.pathname).toBe("/abfahrt/api/departures");
    expect(url.searchParams.get("stop")).toBe("vrr:de:05111:18235");
  });

  it("verlinkt bei Transitous-Daten die Quellenseite", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(departuresResponse([], { source: "transitous" })),
    );
    renderAt("/haltestelle/transitous%3Ade%3A09162%3A6");
    expect(await screen.findByRole("link", { name: /Transitous/ })).toHaveAttribute(
      "href",
      "https://transitous.org/sources/",
    );
    expect(screen.queryByText("Daten: VRR")).toBeNull();
  });

  it("meldet eine unbekannte Haltestelle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "not_found" }, { status: 404 }),
    );
    renderAt("/haltestelle/vrr%3Agibtsnicht");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Diese Haltestelle wurde nicht gefunden.",
    );
  });

  it("zeigt für unbekannte Pfade eine Fehlerseite", () => {
    renderAt("/gibt-es-nicht");
    expect(screen.getByRole("heading", { name: "Seite nicht gefunden" })).toBeInTheDocument();
  });
});
