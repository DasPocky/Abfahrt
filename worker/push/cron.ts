// Cron-Lauf alle 5 Minuten (#72): neue Störungen bei Favoriten und Stand der gemerkten Fahrt
import type { Alert } from "../../shared/api-types";
import { parsePushTopics, type PushTopics } from "../../shared/push-topics";
import { journeySignature } from "../../shared/transfers";
import { filterAlerts } from "../alerts";
import { cached } from "../cache";
import { loadJourneys } from "../journeys";
import { areaAlerts, municipalityOf, stopDhid } from "../sources/vrr-alerts";
import { parseVapidJwk } from "./crypto";
import { sendPush, type PushMessage } from "./send";
import { deleteSubscription, recordResult, saveState, subscriptionsWithTopics } from "./store";
import { checkAlerts, checkTrip, isQuietTime, tripActive, type TripState } from "./triggers";

/** Free-Plan: höchstens 50 Unteranfragen pro Lauf, etwas Reserve lassen */
const SUBREQUEST_BUDGET = 40;
const MAX_SUBSCRIPTIONS = 50;
/** Je Abo und Lauf höchstens so viele Nachrichten */
const MAX_MESSAGES = 2;
/** Basis-URL für die Cache-Schlüssel (der Cron-Lauf hat keine Anfrage) */
const CACHE_BASE = new Request("https://endlab.de/abfahrt/api/cron");

function parseJson<T>(raw: string | null, fallback: T, guard: (v: unknown) => v is T): T {
  if (raw === null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function parseUnknown(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isTripState(v: unknown): v is TripState {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function runPushCron(
  env: Env,
  ctx: ExecutionContext,
  now = new Date(),
): Promise<{ sent: number }> {
  const vapid = parseVapidJwk(env.VAPID_PRIVATE_JWK);
  if (!vapid) return { sent: 0 };
  let budget = SUBREQUEST_BUDGET;
  let sent = 0;
  const quiet = isQuietTime(now);
  const alertsByStop = new Map<string, Alert[]>();

  /** Meldungen einer Haltestelle (Gemeinde und Meldungen gecacht, teilen sich alle Abos) */
  async function stopAlerts(stopId: string, lines: string[]): Promise<Alert[]> {
    const dhid = stopDhid(stopId.slice("vrr:".length));
    let all = alertsByStop.get(dhid);
    if (!all) {
      if (budget < 2) return [];
      budget -= 2;
      const municipality = await cached(CACHE_BASE, ctx, `omc:v1:${dhid}`, 30 * 24 * 60 * 60, () =>
        municipalityOf(dhid),
      );
      all = municipality
        ? await cached(CACHE_BASE, ctx, `alerts:v2:${municipality.omc}`, 5 * 60, () =>
            areaAlerts(municipality.omc),
          )
        : [];
      alertsByStop.set(dhid, all);
    }
    return filterAlerts(all, `vrr:${dhid}`, lines);
  }

  const rows = await subscriptionsWithTopics(env.PUSH_DB, MAX_SUBSCRIPTIONS);
  for (const row of rows) {
    if (budget <= 0) break;
    const topics: PushTopics | null = parsePushTopics(parseUnknown(row.topics));
    if (!topics) continue;
    const messages: PushMessage[] = [];
    let seen = parseJson<string[] | null>(
      row.seen_alerts,
      null,
      (v): v is string[] | null => v === null || isStringArray(v),
    );
    let tripState = parseJson<TripState>(row.trip_state, {}, isTripState);

    try {
      // Gemerkte Fahrt (meldet sich auch in der Ruhezeit)
      if (topics.trip && tripActive(topics.trip, now) && budget > 1) {
        budget -= 2;
        const result = await loadJourneys(
          topics.trip.from,
          topics.trip.to,
          new Date(Date.parse(topics.trip.departure) - 60_000),
          false,
          topics.trip.options,
        );
        const journey =
          result.journeys.find((j) => journeySignature(j) === topics.trip?.signature) ?? null;
        const check = checkTrip(topics.trip, journey, tripState);
        messages.push(...check.messages);
        tripState = check.state;
      }

      // Neue Störungen bei Favoriten
      if (topics.alerts && topics.stops.length > 0) {
        const lists = await Promise.all(topics.stops.map((s) => stopAlerts(s.id, s.lines)));
        const unique = new Map(lists.flat().map((a) => [a.id, a]));
        const check = checkAlerts([...unique.values()], seen);
        if (!quiet) messages.push(...check.messages);
        seen = check.seen;
      }
    } catch (err) {
      // Datenquelle gerade nicht erreichbar: nächster Lauf versucht es erneut
      console.error("push-cron", err);
      continue;
    }

    for (const message of messages.slice(0, MAX_MESSAGES)) {
      if (budget <= 0) break;
      budget -= 1;
      const result = await sendPush(
        row,
        message,
        vapid,
        message.tag === "trip" ? "high" : "normal",
      );
      if (result === "gone") {
        await deleteSubscription(env.PUSH_DB, row.endpoint);
        break;
      }
      await recordResult(env.PUSH_DB, row.id, result === "ok");
      if (result === "ok") sent += 1;
    }
    await saveState(
      env.PUSH_DB,
      row.id,
      seen === null ? null : JSON.stringify(seen),
      JSON.stringify(tripState),
    );
  }
  return { sent };
}
