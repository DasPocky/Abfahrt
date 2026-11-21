// Barrierefreiheit (#128): axe-core über alle Hauptseiten mit Testdaten. Kontrast und Zielgröße
// braucht echtes Layout; die prüft das Browser-Audit (docs/07-barrierefreiheit.md).
import { screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alert,
  alertsResponse,
  departure,
  departuresResponse,
  journey,
  journeyLeg,
  journeysResponse,
  renderAt,
  requestUrl,
  STOP_HBF,
  STOP_HHA,
} from "./test-utils";

function mockApi() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = requestUrl(input);
    const path = url.pathname;
    if (path.endsWith("/departures")) {
      return Response.json(
        departuresResponse([
          departure({ id: "a", line: "U79", notices: ["Umleitung"] }),
          departure({ id: "b", line: "707", mode: "tram", cancelled: true }),
        ]),
      );
    }
    if (path.endsWith("/journeys")) return Response.json(journeysResponse([journey({ id: "j1" })]));
    if (path.endsWith("/trip")) {
      return Response.json({
        leg: journeyLeg(),
        source: "vrr",
        generatedAt: new Date().toISOString(),
      });
    }
    if (path.endsWith("/alerts")) return Response.json(alertsResponse([alert({ id: "x" })]));
    if (path.includes("/stops/")) return Response.json({ stops: [STOP_HBF, STOP_HHA] });
    return new Response(null, { status: 404 });
  });
}

async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
    rules: {
      // brauchen echtes Layout bzw. echte Farben (jsdom)
      "color-contrast": { enabled: false },
      "target-size": { enabled: false },
    },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Barrierefreiheit (#128)", () => {
  it.each([
    ["/", "Abfahrten"],
    [`/haltestelle/${encodeURIComponent(STOP_HBF.id)}`, "Düsseldorf Hbf"],
    [`/verbindung?von=${STOP_HHA.id}&vonName=HHA&nach=${STOP_HBF.id}&nachName=Hbf`, "Verbindung"],
    ["/stoerungen", /^Störungen/],
    ["/mehr", "Mehr"],
    ["/einstellungen", "Einstellungen"],
    ["/ueber", "Über Abfahrt"],
    ["/barrierefreiheit", "Barrierefreiheit"],
    [`/verlauf?ref=${encodeURIComponent("efa|vrr|x|de:05111:18235|1|202611131200")}`, /nach/],
  ])("%s ohne axe-Verstöße", async (path, heading) => {
    mockApi();
    renderAt(path);
    await screen.findByRole("heading", { level: 1, name: heading });
    // Daten nachgeladen (keine Ladeanzeige mehr)
    await waitFor(() => expect(screen.queryByText(/wird geladen|werden geladen/)).toBeNull());
    expect(await violations()).toEqual([]);
  });

  it("setzt je Seite einen eigenen Titel", async () => {
    mockApi();
    renderAt(`/haltestelle/${encodeURIComponent(STOP_HBF.id)}`);
    await waitFor(() => expect(document.title).toBe("Abfahrten Düsseldorf Hbf · Abfahrt"));
  });

  it("setzt nach einem Seitenwechsel den Fokus auf die neue Überschrift", async () => {
    mockApi();
    const { router } = renderAt("/");
    await router.navigate("/mehr");
    const heading = await screen.findByRole("heading", { level: 1, name: "Mehr" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.title).toBe("Mehr · Abfahrt");
  });
});
