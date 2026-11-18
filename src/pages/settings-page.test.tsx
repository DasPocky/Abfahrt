import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, getSettings } from "@/lib/settings";
import { renderAt } from "../test-utils";

afterEach(() => {
  localStorage.clear();
  applyTheme("system");
});

describe("Einstellungen (#37)", () => {
  it("ist über „Mehr“ erreichbar", () => {
    renderAt("/mehr");
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute(
      "href",
      "/abfahrt/einstellungen",
    );
  });

  it("speichert Darstellung, Hell/Dunkel und Abfahrten je Favorit", () => {
    renderAt("/einstellungen");
    expect(screen.getByRole("radio", { name: /Linie vorn/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("radio", { name: /Anzeigetafel/ }));
    expect(screen.getByRole("radio", { name: /Anzeigetafel/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Dunkel" }));
    fireEvent.click(screen.getByRole("button", { name: "6" }));
    fireEvent.click(screen.getByRole("button", { name: "Langsam" }));
    expect(getSettings()).toEqual({
      rowStyle: "b",
      theme: "dark",
      favoriteCount: 6,
      speechRate: "slow",
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(JSON.parse(localStorage.getItem("abfahrt:settings") ?? "{}")).toMatchObject({
      version: 1,
    });
  });

  it("löscht den Suchverlauf (#119)", () => {
    localStorage.setItem(
      "abfahrt:recent",
      JSON.stringify({ version: 1, items: [{ id: "vrr:1", name: "Benrath S", kind: "stop" }] }),
    );
    renderAt("/einstellungen");
    expect(screen.getByText(/1 zuletzt gesuchte Ort/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verlauf löschen" }));
    expect(localStorage.getItem("abfahrt:recent")).toBeNull();
    expect(screen.getByRole("button", { name: "Verlauf löschen" })).toBeDisabled();
  });
});
