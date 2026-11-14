// Favoriten im localStorage. Alle Apps unter endlab.de teilen sich den Speicher,
// daher das Präfix "abfahrt:" (siehe docs/02-architektur.md).
import type { Stop } from "../../shared/api-types";
import {
  type DepartureFilter,
  EMPTY_FILTER,
  filterFromParams,
  filterKey,
  filterToParams,
} from "@/lib/filters";

export const FAVORITES_KEY = "abfahrt:favorites";
const CURRENT_VERSION = 2;
const MAX_FAVORITES = 20;
const MAX_LABEL_LENGTH = 40;

/** Ein Favorit ist eine Haltestelle mit einer gespeicherten Ansicht (Filter). */
export interface Favorite {
  /** Eindeutig: Haltestelle + Filter */
  key: string;
  stopId: string;
  name: string;
  place?: string;
  /** Eigener Name, sonst wird er aus Haltestelle und Filter gebildet */
  label?: string;
  filter: DepartureFilter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function favoriteKey(stopId: string, filter: DepartureFilter): string {
  const f = filterKey(filter);
  return f ? `${stopId}?${f}` : stopId;
}

function make(
  stopId: string,
  name: string,
  place: string | undefined,
  filter: DepartureFilter,
  label?: string,
): Favorite {
  const { time: _time, ...rest } = filter;
  const fav: Favorite = { key: favoriteKey(stopId, rest), stopId, name, filter: rest };
  if (place) fav.place = place;
  const trimmed = label?.trim().slice(0, MAX_LABEL_LENGTH);
  if (trimmed) fav.label = trimmed;
  return fav;
}

/** v1: { id, name, place? } ohne Filter */
function fromV1(item: unknown): Favorite | null {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return null;
  if (!optionalString(item.place)) return null;
  return make(item.id, item.name, item.place, EMPTY_FILTER);
}

/** v2: { stopId, name, place?, label?, filter: "<URL-Parameter>" } */
function fromV2(item: unknown): Favorite | null {
  if (!isRecord(item) || typeof item.stopId !== "string" || typeof item.name !== "string")
    return null;
  if (!optionalString(item.place) || !optionalString(item.label) || !optionalString(item.filter)) {
    return null;
  }
  return make(
    item.stopId,
    item.name,
    item.place,
    filterFromParams(new URLSearchParams(item.filter ?? "")),
    item.label,
  );
}

/** Liest gespeicherte Daten robust ein (inkl. Migration v1 → v2); Kaputtes ergibt eine leere Liste. */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(data) || !Array.isArray(data.items)) return [];
  const items: unknown[] = data.items;
  const convert = data.version === 1 ? fromV1 : data.version === 2 ? fromV2 : null;
  if (!convert) return [];
  const seen = new Set<string>();
  const result: Favorite[] = [];
  for (const item of items) {
    const fav = convert(item);
    if (fav && !seen.has(fav.key)) {
      seen.add(fav.key);
      result.push(fav);
    }
  }
  return result;
}

export function serializeFavorites(items: readonly Favorite[]): string {
  return JSON.stringify({
    version: CURRENT_VERSION,
    items: items.map((f) => ({
      stopId: f.stopId,
      name: f.name,
      ...(f.place ? { place: f.place } : {}),
      ...(f.label ? { label: f.label } : {}),
      filter: filterToParams(f.filter, false).toString(),
    })),
  });
}

export function toFavorite(
  stop: Pick<Stop, "id" | "name" | "place">,
  filter: DepartureFilter = EMPTY_FILTER,
  label?: string,
): Favorite {
  return make(stop.id, stop.name, stop.place, filter, label);
}

export function addFavorite(items: readonly Favorite[], favorite: Favorite): Favorite[] {
  if (items.some((f) => f.key === favorite.key)) return [...items];
  return [...items, favorite].slice(-MAX_FAVORITES);
}

export function removeFavorite(items: readonly Favorite[], key: string): Favorite[] {
  return items.filter((f) => f.key !== key);
}

export function renameFavorite(items: readonly Favorite[], key: string, label: string): Favorite[] {
  return items.map((f) => (f.key === key ? make(f.stopId, f.name, f.place, f.filter, label) : f));
}

/** Verschiebt einen Favoriten um `delta` Plätze (−1 = nach oben). */
export function moveFavorite(items: readonly Favorite[], key: string, delta: number): Favorite[] {
  const from = items.findIndex((f) => f.key === key);
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
