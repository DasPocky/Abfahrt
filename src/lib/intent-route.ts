// Wunsch → Seite (#131): Orte über die Suche auflösen (Haltestellen zuerst) und den Link bauen.
import type { Stop } from "../../shared/api-types";
import { nearbyStops, searchStops, stopPath } from "@/lib/api";
import { rankStops, type Position } from "@/lib/geo";
import type { Intent } from "@/lib/intent";
import { EMPTY_JOURNEY_QUERY, journeyPath } from "@/lib/journeys";
import { stopLabel } from "@/lib/stop-label";

export type IntentTarget =
  { ok: true; path: string; state?: { stopName: string } } | { ok: false; message: string };

async function bestStop(name: string, position: Position | null, signal?: AbortSignal) {
  const { stops } = await searchStops(name, signal);
  return rankStops(stops, position, 1)[0]?.stop ?? null;
}

function isStop(s: Stop): boolean {
  return s.kind === undefined || s.kind === "stop";
}

/** Haltestellen zuerst; Adressen/Orte nur ohne passende Haltestelle oder mit Hausnummer */
async function bestPlace(name: string, position: Position | null, signal?: AbortSignal) {
  const { stops } = await searchStops(name, signal, true);
  const stopHit = rankStops(stops.filter(isStop), position, 1)[0]?.stop;
  const placeHit = rankStops(
    stops.filter((s) => !isStop(s)),
    position,
    1,
  )[0]?.stop;
  if (/\s\d{1,4}\s?[a-z]?$/i.test(name.trim())) return placeHit ?? stopHit ?? null;
  return stopHit ?? placeHit ?? null;
}

async function nearestStop(position: Position | null, signal?: AbortSignal): Promise<Stop | null> {
  if (!position) return null;
  const { stops } = await nearbyStops(position.lat, position.lon, signal);
  return rankStops(stops, position, 1)[0]?.stop ?? null;
}

const picked = (stop: Stop) => ({ id: stop.id, name: stopLabel(stop) });

export async function intentTarget(
  intent: Intent,
  position: Position | null,
  signal?: AbortSignal,
): Promise<IntentTarget> {
  if (intent.kind === "departures") {
    const stop = await bestStop(intent.stop, position, signal);
    if (!stop) return { ok: false, message: `Keine Haltestelle „${intent.stop}“ gefunden.` };
    const params = new URLSearchParams();
    if (intent.line) params.set("linie", intent.line);
    if (intent.time) params.set("zeit", intent.time);
    const query = params.toString();
    return {
      ok: true,
      path: query ? `${stopPath(stop.id)}?${query}` : stopPath(stop.id),
      state: { stopName: stop.name },
    };
  }

  const [from, to] = await Promise.all([
    intent.from === null ? nearestStop(position, signal) : bestPlace(intent.from, position, signal),
    bestPlace(intent.to, position, signal),
  ]);
  if (!to) return { ok: false, message: `Kein Ziel „${intent.to}“ gefunden.` };
  if (intent.from !== null && !from) {
    return { ok: false, message: `Keinen Start „${intent.from}“ gefunden.` };
  }
  return {
    ok: true,
    path: journeyPath({
      ...EMPTY_JOURNEY_QUERY,
      // ohne Standort bleibt der Start leer und lässt sich auf der Seite wählen
      from: from ? picked(from) : null,
      to: picked(to),
      time: intent.time,
      arrive: intent.arrive,
    }),
  };
}
