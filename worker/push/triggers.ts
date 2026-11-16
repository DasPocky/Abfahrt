// Auslöse-Logik für Push (#72), rein und getestet: Was ist neu, was hat sich geändert?
import type { Alert, Journey } from "../../shared/api-types";
import type { PushTripTopic } from "../../shared/push-topics";
import { isJourneyCancelled, journeyTransferRisk } from "../../shared/transfers";
import type { PushMessage } from "./send";

const MINUTE_MS = 60_000;
/** Ab so viel Verspätung (Minuten) an der ersten Abfahrt wird gemeldet */
export const DELAY_THRESHOLD = 5;
/** Erneut melden, wenn sich die Verspätung um so viel geändert hat */
const DELAY_STEP = 3;
/** So viele gemeldete Störungs-IDs merken (ältere fallen heraus) */
const MAX_SEEN = 300;
/** Begleitung der Fahrt: ab so lange vor der Abfahrt bis kurz nach der Ankunft */
export const TRIP_LEAD_MS = 60 * MINUTE_MS;
const TRIP_TAIL_MS = 10 * MINUTE_MS;

// ---- Störungen ----

export interface AlertCheck {
  messages: PushMessage[];
  /** neue Liste gemeldeter IDs */
  seen: string[];
}

/**
 * Neue Meldungen gegenüber `seen`. Beim ersten Mal (`seen` null) wird nur erfasst, nicht
 * gemeldet, damit nach dem Einschalten keine Flut alter Meldungen kommt.
 */
export function checkAlerts(alerts: readonly Alert[], seen: readonly string[] | null): AlertCheck {
  const ids = alerts.map((a) => a.id);
  if (seen === null) return { messages: [], seen: ids.slice(-MAX_SEEN) };
  const known = new Set(seen);
  const fresh = alerts.filter((a) => !known.has(a.id));
  const nextSeen = [...seen.filter((id) => ids.includes(id)), ...fresh.map((a) => a.id)].slice(
    -MAX_SEEN,
  );
  if (fresh.length === 0) return { messages: [], seen: nextSeen };
  const first = fresh[0];
  const lines = [...new Set(fresh.flatMap((a) => a.lines.map((l) => l.line)))].slice(0, 4);
  const message: PushMessage =
    fresh.length === 1 && first
      ? {
          title: lines.length > 0 ? `Störung: ${lines.join(", ")}` : "Neue Störung",
          body: first.title,
          url: "/abfahrt/stoerungen",
          tag: "alerts",
        }
      : {
          title: `${fresh.length} neue Störungen bei deinen Favoriten`,
          body: fresh
            .map((a) => a.title)
            .slice(0, 3)
            .join(" · "),
          url: "/abfahrt/stoerungen",
          tag: "alerts",
        };
  return { messages: [message], seen: nextSeen };
}

/** Ruhezeit 22–6 Uhr in Europe/Berlin */
const HOUR_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  hourCycle: "h23",
});

export function isQuietTime(now: Date): boolean {
  const hour = Number(HOUR_FORMAT.formatToParts(now).find((p) => p.type === "hour")?.value);
  return hour >= 22 || hour < 6;
}

// ---- Gemerkte Fahrt ----

export interface TripState {
  signature?: string;
  /** zuletzt gemeldete Verspätung in Minuten */
  delay?: number;
  risk?: "tight" | "missed";
  cancelled?: boolean;
  missing?: boolean;
}

export function tripActive(trip: PushTripTopic, now: Date): boolean {
  const t = now.getTime();
  return (
    t >= Date.parse(trip.departure) - TRIP_LEAD_MS && t <= Date.parse(trip.arrival) + TRIP_TAIL_MS
  );
}

/** Verspätung der ersten Fahrt am Einstieg in Minuten (null ohne Echtzeit) */
export function departureDelay(journey: Journey): number | null {
  const leg = journey.legs.find((l) => l.kind === "transit");
  const planned = Date.parse(leg?.origin.plannedDeparture ?? "");
  const realtime = Date.parse(leg?.origin.realtimeDeparture ?? "");
  if (Number.isNaN(planned) || Number.isNaN(realtime)) return null;
  return Math.round((realtime - planned) / MINUTE_MS);
}

export interface TripCheck {
  messages: PushMessage[];
  state: TripState;
}

/** Änderungen der gemerkten Fahrt gegenüber dem zuletzt gemeldeten Stand */
export function checkTrip(
  trip: PushTripTopic,
  journey: Journey | null,
  previous: TripState,
): TripCheck {
  const state: TripState =
    previous.signature === trip.signature ? { ...previous } : { signature: trip.signature };
  const messages: PushMessage[] = [];
  const base = { url: "/abfahrt/fahrt", tag: "trip" };

  if (!journey) {
    if (!state.missing) {
      messages.push({
        ...base,
        title: "Verbindung nicht mehr im Fahrplan",
        body: `${trip.label}: evtl. ausgefallen. Alternativen in der App.`,
      });
      state.missing = true;
    }
    return { messages, state };
  }
  state.missing = false;

  if (isJourneyCancelled(journey)) {
    if (!state.cancelled) {
      messages.push({
        ...base,
        title: "Fahrt fällt aus",
        body: `${trip.label}: Ein Teil fällt aus. Alternativen in der App.`,
      });
      state.cancelled = true;
    }
    return { messages, state };
  }
  state.cancelled = false;

  const risk = journeyTransferRisk(journey) ?? undefined;
  if (risk && risk !== state.risk && !(state.risk === "missed" && risk === "tight")) {
    messages.push({
      ...base,
      title: risk === "missed" ? "Anschluss nicht erreichbar" : "Anschluss gefährdet",
      body: `${trip.label}: Umstieg wird knapp.`,
    });
  }
  state.risk = risk;

  const delay = departureDelay(journey);
  if (delay !== null && delay >= DELAY_THRESHOLD) {
    if (state.delay === undefined || Math.abs(delay - state.delay) >= DELAY_STEP) {
      const leg = journey.legs.find((l) => l.kind === "transit");
      messages.push({
        ...base,
        title: `${leg?.line ?? "Fahrt"} +${delay} Min`,
        body: `${trip.label}: Abfahrt ab ${leg?.origin.name ?? "Start"} später.`,
      });
      state.delay = delay;
    }
  } else if (delay !== null && delay < DELAY_THRESHOLD) {
    delete state.delay;
  }
  return { messages, state };
}
