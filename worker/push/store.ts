import type { SubscriptionKeys } from "./crypto";

export interface StoredSubscription extends SubscriptionKeys {
  id: string;
  endpoint: string;
  topics: string;
}

/** Kennung eines Abos: SHA-256 des Endpunkts (hex), damit er nicht in Logs/URLs auftaucht */
export async function subscriptionId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveSubscription(
  db: D1Database,
  endpoint: string,
  keys: SubscriptionKeys,
  topics: string,
  now = Date.now(),
): Promise<string> {
  const id = await subscriptionId(endpoint);
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, topics, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT(id) DO UPDATE SET p256dh = ?3, auth = ?4, topics = ?5, updated_at = ?6, failures = 0`,
    )
    .bind(id, endpoint, keys.p256dh, keys.auth, topics, now)
    .run();
  return id;
}

export async function findSubscription(
  db: D1Database,
  endpoint: string,
): Promise<StoredSubscription | null> {
  const id = await subscriptionId(endpoint);
  return db
    .prepare("SELECT id, endpoint, p256dh, auth, topics FROM push_subscriptions WHERE id = ?1")
    .bind(id)
    .first<StoredSubscription>();
}

export async function deleteSubscription(db: D1Database, endpoint: string): Promise<boolean> {
  const id = await subscriptionId(endpoint);
  const result = await db.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}

export async function recordResult(
  db: D1Database,
  id: string,
  ok: boolean,
  now = Date.now(),
): Promise<void> {
  const statement = ok
    ? db
        .prepare("UPDATE push_subscriptions SET last_success_at = ?2, failures = 0 WHERE id = ?1")
        .bind(id, now)
    : db.prepare("UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?1").bind(id);
  await statement.run();
}

export interface CronRow extends StoredSubscription {
  seen_alerts: string | null;
  trip_state: string;
}

export async function updateTopics(
  db: D1Database,
  endpoint: string,
  topics: string,
  now = Date.now(),
): Promise<boolean> {
  const id = await subscriptionId(endpoint);
  const result = await db
    .prepare("UPDATE push_subscriptions SET topics = ?2, updated_at = ?3 WHERE id = ?1")
    .bind(id, topics, now)
    .run();
  return result.meta.changes > 0;
}

/** Abos mit Interessen (alles außer leerer Liste/aus) für den Cron-Lauf */
export async function subscriptionsWithTopics(db: D1Database, limit: number): Promise<CronRow[]> {
  const result = await db
    .prepare(
      `SELECT id, endpoint, p256dh, auth, topics, seen_alerts, trip_state FROM push_subscriptions
       WHERE topics != '[]' ORDER BY updated_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<CronRow>();
  return result.results;
}

export async function saveState(
  db: D1Database,
  id: string,
  seenAlerts: string | null,
  tripState: string,
): Promise<void> {
  await db
    .prepare("UPDATE push_subscriptions SET seen_alerts = ?2, trip_state = ?3 WHERE id = ?1")
    .bind(id, seenAlerts, tripState)
    .run();
}
