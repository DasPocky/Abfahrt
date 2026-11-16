// Push-Endpunkte (#71): öffentlicher Schlüssel, Abo anlegen/löschen, Testnachricht
import { BASE_PATH } from "../../shared/base-path";
import { apiError, json } from "../http";
import { parseVapidJwk, vapidPublicKey, type SubscriptionKeys } from "./crypto";
import { isAllowedEndpoint, sendPush } from "./send";
import { parsePushTopics } from "../../shared/push-topics";
import {
  deleteSubscription,
  findSubscription,
  recordResult,
  saveSubscription,
  updateTopics,
} from "./store";

const MAX_BODY_BYTES = 16_384;
const B64URL = /^[A-Za-z0-9_-]+$/;

export type PushRoute =
  "push/key" | "push/subscribe" | "push/unsubscribe" | "push/test" | "push/topics";
export const PUSH_ROUTES: ReadonlySet<string> = new Set<PushRoute>([
  "push/key",
  "push/subscribe",
  "push/unsubscribe",
  "push/test",
  "push/topics",
]);

interface SubscriptionBody {
  endpoint: string;
  keys: SubscriptionKeys;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Abo aus `PushSubscription.toJSON()` prüfen */
export function parseSubscription(value: unknown): SubscriptionBody | null {
  if (!isRecord(value) || typeof value.endpoint !== "string" || !isRecord(value.keys)) return null;
  const { p256dh, auth } = value.keys;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!B64URL.test(p256dh) || !B64URL.test(auth) || p256dh.length > 100 || auth.length > 40) {
    return null;
  }
  if (value.endpoint.length > 1000 || !isAllowedEndpoint(value.endpoint)) return null;
  return { endpoint: value.endpoint, keys: { p256dh, auth } };
}

/** JSON-Body lesen: nur gleiche Herkunft (Origin), Content-Type JSON, höchstens 4 KB */
async function readJson(request: Request): Promise<unknown> {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) throw new Error("forbidden_origin");
  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) {
    throw new Error("invalid_body");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("invalid_body");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_body");
  }
}

export async function handlePush(request: Request, env: Env, route: string): Promise<Response> {
  const vapid = parseVapidJwk(env.VAPID_PRIVATE_JWK);
  if (!vapid) return apiError(503, "push_unavailable", "Push ist gerade nicht eingerichtet");

  if (route === "push/key") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "GET, HEAD" } },
      );
    }
    return json(
      { publicKey: vapidPublicKey(vapid) },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (err) {
    const forbidden = err instanceof Error && err.message === "forbidden_origin";
    return forbidden
      ? apiError(403, "forbidden_origin", "Nur aus der App heraus erlaubt")
      : apiError(400, "invalid_body", "JSON mit höchstens 16 KB erwartet");
  }
  const subscription = parseSubscription(isRecord(body) ? body.subscription : null);
  if (!subscription) return apiError(400, "invalid_subscription", "Ungültiges Push-Abo");

  switch (route) {
    case "push/subscribe": {
      await saveSubscription(env.PUSH_DB, subscription.endpoint, subscription.keys, "[]");
      return json({ status: "subscribed" });
    }
    case "push/topics": {
      const topics = parsePushTopics(isRecord(body) ? body.topics : null);
      if (!topics)
        return apiError(400, "invalid_topics", "Ungültige Angaben für Benachrichtigungen");
      const stored = JSON.stringify(topics);
      if (stored.length > 16_000) return apiError(400, "invalid_topics", "Zu viele Angaben");
      // Abo ggf. neu anlegen (z. B. nach Löschen durch den Push-Dienst), dann Interessen setzen
      if (!(await updateTopics(env.PUSH_DB, subscription.endpoint, stored))) {
        await saveSubscription(env.PUSH_DB, subscription.endpoint, subscription.keys, stored);
      }
      return json({ status: "saved" });
    }
    case "push/unsubscribe": {
      await deleteSubscription(env.PUSH_DB, subscription.endpoint);
      return json({ status: "unsubscribed" });
    }
    default: {
      // Testnachricht nur an ein bereits gespeichertes Abo
      const stored = await findSubscription(env.PUSH_DB, subscription.endpoint);
      if (!stored) return apiError(404, "not_subscribed", "Kein Push-Abo gespeichert");
      const result = await sendPush(
        stored,
        {
          title: "Abfahrt",
          body: "Benachrichtigungen funktionieren. 🚋",
          url: `${BASE_PATH}/`,
          tag: "test",
        },
        vapid,
      );
      if (result === "gone") await deleteSubscription(env.PUSH_DB, stored.endpoint);
      else await recordResult(env.PUSH_DB, stored.id, result === "ok");
      return result === "ok"
        ? json({ status: "sent" })
        : apiError(502, "push_failed", "Push-Dienst hat die Nachricht nicht angenommen");
    }
  }
}
