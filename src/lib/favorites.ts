// Favoriten im localStorage. Alle Apps unter endlab.de teilen sich den Speicher,
// daher das Präfix "abfahrt:" (siehe docs/02-architektur.md).
import type { Stop } from "../../shared/api-types";

export const FAVORITES_KEY = "abfahrt:favorites";
const CURRENT_VERSION = 1;
const MAX_FAVORITES = 20;

export interface Favorite {
  id: string;
  name: string;
  place?: string;
}

interface StoredFavoritesV1 {
  version: 1;
  items: Favorite[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFavorite(value: unknown): value is Favorite {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.place === undefined || typeof value.place === "string")
  );
}

/** Liest gespeicherte Daten robust ein; Unbekanntes oder Kaputtes ergibt eine leere Liste. */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  // Künftige Versionen: hier migrieren
  if (!isRecord(data) || data.version !== CURRENT_VERSION || !Array.isArray(data.items)) return [];
  const items: unknown[] = data.items;
  const seen = new Set<string>();
  return items.filter((item): item is Favorite => {
    if (!isFavorite(item) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function serializeFavorites(items: readonly Favorite[]): string {
  const stored: StoredFavoritesV1 = { version: CURRENT_VERSION, items: [...items] };
  return JSON.stringify(stored);
}

export function toFavorite(stop: Pick<Stop, "id" | "name" | "place">): Favorite {
  return stop.place
    ? { id: stop.id, name: stop.name, place: stop.place }
    : { id: stop.id, name: stop.name };
}

export function addFavorite(items: readonly Favorite[], favorite: Favorite): Favorite[] {
  if (items.some((f) => f.id === favorite.id)) return [...items];
  return [...items, favorite].slice(-MAX_FAVORITES);
}

export function removeFavorite(items: readonly Favorite[], id: string): Favorite[] {
  return items.filter((f) => f.id !== id);
}

/** Verschiebt einen Favoriten um `delta` Plätze (−1 = nach oben). */
export function moveFavorite(items: readonly Favorite[], id: string, delta: number): Favorite[] {
  const from = items.findIndex((f) => f.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

// ---- Speicher mit Benachrichtigung (für useSyncExternalStore) ----

const listeners = new Set<() => void>();
let cache: { raw: string | null; items: Favorite[] } | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(FAVORITES_KEY);
  } catch {
    return null; // z. B. privater Modus mit gesperrtem Speicher
  }
}

export function getFavorites(): Favorite[] {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, items: parseFavorites(raw) };
  return cache.items;
}

export function setFavorites(items: readonly Favorite[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, serializeFavorites(items));
  } catch {
    // Speichern nicht möglich: Änderung gilt nur bis zum Neuladen
    cache = { raw: null, items: [...items] };
  }
  for (const listener of listeners) listener();
}

export function subscribeFavorites(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
