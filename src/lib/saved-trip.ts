// Gemerkte Verbindung für die Live-Begleitung: lokal gespeichert, Status „nächster Schritt“
import type { Journey, JourneyLeg } from "../../shared/api-types";
import { DEFAULT_JOURNEY_OPTIONS, type JourneyOptions } from "../../shared/journey-options";
import { isJourney } from "./api";
import { journeyTimes, type PickedStop } from "./journeys";
import { platformLabel } from "./modes";
import { formatClock, formatCountdown } from "./time";

/** Alle Apps unter endlab.de teilen den Speicher, daher das Präfix */
export const SAVED_TRIP_KEY = "abfahrt:trip";
const VERSION = 1;
/** So lange nach der Ankunft bleibt die Fahrt noch sichtbar */
export const KEEP_AFTER_ARRIVAL_MS = 30 * 60_000;

export interface SavedTrip {
  from: PickedStop;
  to: PickedStop;
  options: JourneyOptions;
  /** Erkennungsmerkmal, um die Verbindung in neuen Antworten wiederzufinden */
  signature: string;
  /** Stand beim Merken bzw. beim letzten Abruf (Anzeige ohne Netz) */
  journey: Journey;
  savedAt: string;
}

/** Fahrten mit Linie und geplanter Abfahrt am Einstieg, z. B. „U76@…|S6@…“ */
export function journeySignature(journey: Journey): string {
  return journey.legs
    .filter((l) => l.kind === "transit")
    .map((l) => `${l.line ?? ""}@${l.origin.plannedDeparture ?? ""}`)
    .join("|");
}

export function findJourney(journeys: readonly Journey[], signature: string): Journey | null {
  return journeys.find((j) => journeySignature(j) === signature) ?? null;
}

/** Ab diesem Zeitpunkt (geplante Abfahrt der Verbindung) fragt die Live-Ansicht neu ab */
export function tripQueryTime(trip: SavedTrip): string | undefined {
  return journeyTimes(trip.journey).plannedDeparture ?? undefined;
}

/** Ist die Fahrt vorbei (Ankunft + 30 Minuten)? */
export function isTripOver(trip: SavedTrip, now: Date): boolean {
  const t = journeyTimes(trip.journey);
  const arrival = Date.parse(t.realtimeArrival ?? t.plannedArrival ?? "");
  return !Number.isNaN(arrival) && now.getTime() > arrival + KEEP_AFTER_ARRIVAL_MS;
}

// ---- Status: was als Nächstes passiert ----

export type TripStep =
  | { kind: "before"; leg: JourneyLeg; at: number }
  | { kind: "riding"; leg: JourneyLeg; at: number }
  | { kind: "transfer"; leg: JourneyLeg; at: number }
  | { kind: "arrived"; at: number };

function legDeparture(leg: JourneyLeg): number {
  return Date.parse(leg.origin.realtimeDeparture ?? leg.origin.plannedDeparture ?? "");
}

function legArrival(leg: JourneyLeg): number {
  return Date.parse(leg.destination.realtimeArrival ?? leg.destination.plannedArrival ?? "");
}

/**
 * Nächster Schritt nach Echtzeit: vor der ersten Fahrt „before“ (Abfahrt), während einer Fahrt
 * „riding“ (Ankunft am Ausstieg), zwischen zwei Fahrten „transfer“ (Abfahrt der nächsten),
 * danach „arrived“. Fußwege zählen zur Wartezeit vor der nächsten Fahrt.
 */
export function tripStep(journey: Journey, now: Date): TripStep {
  const t = now.getTime();
  const rides = journey.legs.filter((l) => l.kind === "transit");
  for (const [index, leg] of rides.entries()) {
    const dep = legDeparture(leg);
    const arr = legArrival(leg);
    if (Number.isNaN(dep) || t < dep) {
      return { kind: index === 0 ? "before" : "transfer", leg, at: dep };
    }
    if (Number.isNaN(arr) || t < arr) return { kind: "riding", leg, at: arr };
  }
  const times = journeyTimes(journey);
  return {
    kind: "arrived",
    at: Date.parse(times.realtimeArrival ?? times.plannedArrival ?? ""),
  };
}

// ---- Speicher mit Benachrichtigung (für useSyncExternalStore) ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPicked(value: unknown): value is PickedStop {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

export function parseSavedTrip(raw: string | null): SavedTrip | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== VERSION) return null;
  const { from, to, signature, journey, savedAt, options } = data;
  if (!isPicked(from) || !isPicked(to) || !isJourney(journey)) return null;
  if (typeof signature !== "string" || typeof savedAt !== "string") return null;
  return {
    from,
    to,
    signature,
    journey,
    savedAt,
    // Optionen aus älteren Ständen fehlen ggf.: dann Standard
    options:
      isRecord(options) && Array.isArray(options.exclude)
        ? { ...DEFAULT_JOURNEY_OPTIONS, ...options }
        : DEFAULT_JOURNEY_OPTIONS,
  };
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; trip: SavedTrip | null } | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(SAVED_TRIP_KEY);
  } catch {
    return null;
  }
}

export function getSavedTrip(): SavedTrip | null {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, trip: parseSavedTrip(raw) };
  return cache.trip;
}

export function setSavedTrip(trip: SavedTrip | null): void {
  try {
    if (trip) localStorage.setItem(SAVED_TRIP_KEY, JSON.stringify({ version: VERSION, ...trip }));
    else localStorage.removeItem(SAVED_TRIP_KEY);
  } catch {
    cache = { raw: null, trip };
  }
  for (const listener of listeners) listener();
}

export function subscribeSavedTrip(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_TRIP_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ---- Texte für die Anzeige ----

export interface StepText {
  /** z. B. „U76 ab Holthausen · Gleis 2“ */
  title: string;
  /** z. B. „Abfahrt in 5 Min“ */
  when: string;
}

function boarding(leg: JourneyLeg): string {
  const platform =
    leg.origin.platform !== null
      ? ` · ${platformLabel(leg.mode ?? "other")} ${leg.origin.platform}`
      : "";
  return `${leg.line ?? "Fahrt"} ab ${leg.origin.name}${platform}`;
}

export function stepText(step: TripStep, now: Date): StepText {
  const at = new Date(step.at);
  const countdown = Number.isNaN(step.at) ? "" : formatCountdown(at, now);
  switch (step.kind) {
    case "before":
      return { title: boarding(step.leg), when: `Abfahrt ${countdown}` };
    case "transfer":
      return { title: `Umsteigen: ${boarding(step.leg)}`, when: `Abfahrt ${countdown}` };
    case "riding":
      return {
        title: `In ${step.leg.line ?? "der Fahrt"} bis ${step.leg.destination.name}`,
        when: `Ankunft ${countdown}`,
      };
    default:
      return { title: "Angekommen", when: Number.isNaN(step.at) ? "" : formatClock(at) };
  }
}
