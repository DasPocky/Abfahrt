// Interessen für Push (#72) aus Favoriten, gemerkter Fahrt und Einstellungen bilden (rein, getestet)
import {
  MAX_TOPIC_STOPS,
  serializePushTopics,
  type PushStopTopic,
  type PushTopics,
} from "../../shared/push-topics";
import type { Favorite } from "./favorites";
import { journeyTimes } from "./journeys";
import type { SavedTrip } from "./saved-trip";

/** Gemerkte Einstellungen (alle Apps unter endlab.de teilen den Speicher, daher das Präfix) */
export const PUSH_PREFS_KEY = "abfahrt:push";

export interface PushPrefs {
  alerts: boolean;
  trip: boolean;
  quiet: boolean;
}

export const DEFAULT_PUSH_PREFS: PushPrefs = { alerts: true, trip: true, quiet: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function flag(raw: Record<string, unknown>, key: keyof PushPrefs): boolean {
  const value = raw[key];
  return typeof value === "boolean" ? value : DEFAULT_PUSH_PREFS[key];
}

export function readPushPrefs(): PushPrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PUSH_PREFS_KEY) ?? "null");
    if (!isRecord(raw)) return DEFAULT_PUSH_PREFS;
    return { alerts: flag(raw, "alerts"), trip: flag(raw, "trip"), quiet: flag(raw, "quiet") };
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

export function writePushPrefs(prefs: PushPrefs): void {
  try {
    localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
  }
  window.dispatchEvent(new Event(PUSH_CHANGED));
}

/** Ereignis, wenn sich Abo oder Einstellungen ändern (löst den Abgleich aus) */
export const PUSH_CHANGED = "abfahrt:push-changed";

/** Favoriten-Haltestellen (nur VRR) mit den Linien aus ihren Filtern, höchstens 10 */
export function stopTopics(favorites: readonly Favorite[]): PushStopTopic[] {
  const byStop = new Map<string, PushStopTopic>();
  for (const f of favorites) {
    if (!f.stopId.startsWith("vrr:")) continue;
    const existing = byStop.get(f.stopId);
    if (existing) {
      for (const line of f.filter.lines)
        if (!existing.lines.includes(line)) existing.lines.push(line);
    } else if (byStop.size < MAX_TOPIC_STOPS) {
      byStop.set(f.stopId, { id: f.stopId, name: f.name, lines: [...f.filter.lines] });
    }
  }
  return [...byStop.values()];
}

export function buildPushTopics(
  favorites: readonly Favorite[],
  trip: SavedTrip | null,
  prefs: PushPrefs,
): PushTopics {
  const times = trip ? journeyTimes(trip.journey) : null;
  return {
    alerts: prefs.alerts,
    stops: prefs.alerts ? stopTopics(favorites) : [],
    trip:
      prefs.trip && trip && times?.plannedDeparture && times.plannedArrival
        ? {
            from: trip.from.id,
            to: trip.to.id,
            label: `${trip.from.name} → ${trip.to.name}`,
            options: trip.options,
            signature: trip.signature,
            departure: times.plannedDeparture,
            arrival: times.plannedArrival,
          }
        : null,
    quiet: prefs.quiet,
  };
}

/** Stabile Form zum Vergleichen und Senden */
export function topicsPayload(topics: PushTopics): string {
  return JSON.stringify(serializePushTopics(topics));
}
