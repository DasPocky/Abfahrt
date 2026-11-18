// Zuletzt gewählte Orte der Suche (#119): Haltestellen, Adressen und Orte, nur im Browser.
// Alle Apps unter endlab.de teilen sich den Speicher, daher das Präfix "abfahrt:".
import type { PlaceKind, Stop } from "../../shared/api-types";

export const RECENT_KEY = "abfahrt:recent";
const CURRENT_VERSION = 1;
export const MAX_RECENT = 8;

export interface RecentPlace {
  id: string;
  name: string;
  place?: string;
  kind: PlaceKind;
  lat?: number;
  lon?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const KINDS: readonly PlaceKind[] = ["stop", "address", "poi"];

function fromItem(item: unknown): RecentPlace | null {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return null;
  if (item.id === "" || item.name === "") return null;
  const kind = KINDS.find((k) => k === item.kind) ?? "stop";
  const recent: RecentPlace = { id: item.id, name: item.name, kind };
  if (typeof item.place === "string" && item.place) recent.place = item.place;
  if (typeof item.lat === "number" && typeof item.lon === "number") {
    recent.lat = item.lat;
    recent.lon = item.lon;
  }
  return recent;
}

/** Robust gegen kaputte Daten: Unlesbares ergibt eine leere Liste, Doppelte fallen weg. */
export function parseRecent(raw: string | null): RecentPlace[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(data) || data.version !== CURRENT_VERSION || !Array.isArray(data.items)) return [];
  const items: unknown[] = data.items;
  const seen = new Set<string>();
  const result: RecentPlace[] = [];
  for (const item of items) {
    const recent = fromItem(item);
    if (recent && !seen.has(recent.id)) {
      seen.add(recent.id);
      result.push(recent);
    }
  }
  return result.slice(0, MAX_RECENT);
}

export function serializeRecent(items: readonly RecentPlace[]): string {
  return JSON.stringify({ version: CURRENT_VERSION, items });
}

/** Aus einem Suchtreffer; ohne `kind` ist es eine Haltestelle */
export function toRecent(stop: Stop): RecentPlace {
  const recent: RecentPlace = { id: stop.id, name: stop.name, kind: stop.kind ?? "stop" };
  if (stop.place) recent.place = stop.place;
  if (stop.lat !== undefined && stop.lon !== undefined) {
    recent.lat = stop.lat;
    recent.lon = stop.lon;
  }
  return recent;
}

/** Zurück in die Form eines Suchtreffers (für Anzeige und Auswahl) */
export function recentToStop(recent: RecentPlace): Stop {
  const { kind, ...rest } = recent;
  return kind === "stop" ? rest : { ...rest, kind };
}

/** Neuester Eintrag vorn, derselbe Ort nur einmal, höchstens MAX_RECENT */
export function addRecent(items: readonly RecentPlace[], recent: RecentPlace): RecentPlace[] {
  return [recent, ...items.filter((r) => r.id !== recent.id)].slice(0, MAX_RECENT);
}

export function removeRecent(items: readonly RecentPlace[], id: string): RecentPlace[] {
  return items.filter((r) => r.id !== id);
}

// ---- Speicher mit Benachrichtigung (für useSyncExternalStore) ----

const listeners = new Set<() => void>();
let cache: { raw: string | null; items: RecentPlace[] } | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    return null; // z. B. privater Modus mit gesperrtem Speicher
  }
}

export function getRecent(): RecentPlace[] {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, items: parseRecent(raw) };
  return cache.items;
}

export function setRecent(items: readonly RecentPlace[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(RECENT_KEY);
    else localStorage.setItem(RECENT_KEY, serializeRecent(items));
  } catch {
    // Speichern nicht möglich: Änderung gilt nur bis zum Neuladen
    cache = { raw: null, items: [...items] };
  }
  for (const listener of listeners) listener();
}

/** Merkt einen gewählten Suchtreffer */
export function rememberPlace(stop: Stop): void {
  setRecent(addRecent(getRecent(), toRecent(stop)));
}

export function forgetPlace(id: string): void {
  setRecent(removeRecent(getRecent(), id));
}

export function clearRecent(): void {
  setRecent([]);
}

export function subscribeRecent(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === RECENT_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
