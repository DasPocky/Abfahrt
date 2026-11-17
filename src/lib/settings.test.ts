import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_SETTINGS,
  getSettings,
  parseSettings,
  serializeSettings,
  setSettings,
} from "./settings";

afterEach(() => {
  localStorage.clear();
  applyTheme("system");
});

describe("Einstellungen (#37)", () => {
  it("liest gespeicherte Werte und ersetzt Ungültiges einzeln durch Standardwerte", () => {
    const saved = serializeSettings({ rowStyle: "b", theme: "dark", favoriteCount: 6 });
    expect(parseSettings(saved)).toEqual({ rowStyle: "b", theme: "dark", favoriteCount: 6 });
    expect(parseSettings('{"rowStyle":"z","theme":"dark","favoriteCount":99}')).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "dark",
    });
    expect(parseSettings("kaputt")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("speichert und setzt Hell/Dunkel am Dokument", () => {
    setSettings({ ...DEFAULT_SETTINGS, theme: "dark" });
    expect(getSettings().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    setSettings({ ...DEFAULT_SETTINGS, theme: "system" });
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
