import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderAt } from "@/test-utils";

describe("Über-Seite", () => {
  it("zeigt die Pflicht-Quellhinweise mit Links", () => {
    renderAt("/ueber");
    expect(screen.getByRole("heading", { level: 1, name: "Über Abfahrt" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne Gewähr.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "VRR" })).toHaveAttribute("href", "https://www.vrr.de");
    expect(screen.getByRole("link", { name: "Transitous" })).toHaveAttribute(
      "href",
      "https://transitous.org/sources/",
    );
    expect(screen.getByRole("link", { name: "OpenStreetMap-Mitwirkende" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(screen.getByRole("link", { name: "OpenFreeMap" })).toBeInTheDocument();
  });

  it("verlinkt den Quellcode und nennt Lizenz, Datenschutz und Hobby-Charakter", () => {
    renderAt("/ueber");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/DasPocky/Abfahrt",
    );
    expect(screen.getByText(/AGPL-3\.0/)).toBeInTheDocument();
    expect(screen.getByText("private Hobby-App")).toBeInTheDocument();
    const privacy = screen.getByRole("region", { name: "Datenschutz" });
    expect(
      within(privacy).getByText("Keine Accounts, kein Tracking, keine Cookies."),
    ).toBeVisible();
    expect(within(privacy).getByText(/Favoriten werden nur lokal/)).toBeVisible();
    expect(within(privacy).getByText(/Standort wird nur auf deinen Wunsch/)).toBeVisible();
    expect(within(privacy).getByText(/nur der sichtbare Kartenausschnitt/)).toBeVisible();
  });

  it("öffnet externe Links in neuem Tab ohne Referrer-Zugriff", () => {
    renderAt("/ueber");
    for (const link of screen.getAllByRole("link")) {
      if (!link.getAttribute("href")?.startsWith("https://")) continue;
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("ist aus dem Fußbereich jeder Seite erreichbar", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /Über Abfahrt/ })).toHaveAttribute(
      "href",
      "/abfahrt/ueber",
    );
  });
});
