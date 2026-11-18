import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderAt } from "../test-utils";

describe("Impressum und Datenschutz (#130)", () => {
  it("sind unter „Mehr“ verlinkt", () => {
    renderAt("/mehr");
    const nav = screen.getByRole("navigation", { name: "Infos" });
    expect(within(nav).getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/abfahrt/impressum",
    );
    expect(within(nav).getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
      "href",
      "/abfahrt/datenschutz",
    );
  });

  it("Impressum nennt die Rechtsgrundlage und warnt, solange Angaben fehlen", () => {
    renderAt("/impressum");
    expect(screen.getByRole("heading", { level: 1, name: "Impressum" })).toBeInTheDocument();
    expect(screen.getByText(/§ 18 Abs. 1 Medienstaatsvertrag/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Angaben zum Betreiber fehlen");
  });

  it("Datenschutzerklärung deckt alle Datenflüsse ab", () => {
    renderAt("/datenschutz");
    for (const heading of [
      "1. Verantwortlicher",
      "2. Aufruf der App und Hosting",
      "3. Fahrplan- und Echtzeitdaten",
      "4. Standort",
      "5. Karte (OpenFreeMap)",
      "6. Speicherung auf deinem Gerät",
      "7. Benachrichtigungen",
      "8. Spracheingabe",
      "9. Deine Rechte",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(/Data Privacy Framework/)).toBeInTheDocument();
    expect(screen.getByText(/keine Protokolle der einzelnen Anfragen/)).toBeInTheDocument();
  });
});
