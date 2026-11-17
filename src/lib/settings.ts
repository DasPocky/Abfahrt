// Einstellungen (#37), nur im Browser: Darstellung der Abfahrtszeile, Hell/Dunkel, Abfahrten je
// Favorit. Versioniert gespeichert unter `abfahrt:settings`, robust gelesen.

/** A Linie mit Symbol, B Countdown links (Anzeigetafel), C Karten mit Farbstreifen */
export type RowStyle = "a" | "b" | "c";
export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
  rowStyle: RowStyle;
  theme: ThemeChoice;
  /** Abfahrten je Favorit auf der Startseite */
  favoriteCount: number;
}

export const SETTINGS_KEY = "abfahrt:settings";
const VERSION = 1;

export const ROW_STYLES: readonly RowStyle[] = ["a", "b", "c"];
export const THEMES: readonly ThemeChoice[] = ["system", "light", "dark"];
export const FAVORITE_COUNTS = [3, 4, 6, 8] as const;

export const DEFAULT_SETTINGS: Settings = { rowStyle: "a", theme: "system", favoriteCount: 4 };

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

/** Kaputtes oder Unbekanntes ergibt die Standardwerte (einzeln je Feld) */
export function parseSettings(raw: string | null): Settings {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_SETTINGS;
  const field = (key: string): unknown => (key in data ? Reflect.get(data, key) : undefined);
  return {
    rowStyle: pick(field("rowStyle"), ROW_STYLES, DEFAULT_SETTINGS.rowStyle),
    theme: pick(field("theme"), THEMES, DEFAULT_SETTINGS.theme),
    favoriteCount: pick(field("favoriteCount"), FAVORITE_COUNTS, DEFAULT_SETTINGS.favoriteCount),
  };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: VERSION, ...settings });
}

// ---- Speicher mit Benachrichtigung (für useSyncExternalStore) ----

const listeners = new Set<() => void>();
let cache: { raw: string | null; settings: Settings } | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

export function getSettings(): Settings {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, settings: parseSettings(raw) };
  return cache.settings;
}

export function setSettings(next: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, serializeSettings(next));
  } catch {
    cache = { raw: null, settings: next };
  }
  applyTheme(next.theme);
  for (const listener of listeners) listener();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_KEY) return;
    applyTheme(getSettings().theme);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Hell/Dunkel erzwingen über `data-theme` am <html> (src/index.css). Ohne Attribut folgt die App
 * dem System, wie bisher.
 */
export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}
