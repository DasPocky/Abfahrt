import { encryptPayload, vapidAuthorization, type SubscriptionKeys, type VapidJwk } from "./crypto";

/** Absender-Angabe im VAPID-Token (für Rückfragen der Push-Dienste) */
export const VAPID_SUBJECT = "https://abfahrt.endlab.de";
const TIMEOUT_MS = 10_000;

/** Inhalt einer Benachrichtigung; der Service Worker zeigt sie an (src/pwa/service-worker.js) */
export interface PushMessage {
  title: string;
  body: string;
  /** Seite der App, die beim Antippen öffnet (Pfad an der Wurzel) */
  url: string;
  /** Gleiche Kennung ersetzt eine ältere Benachrichtigung statt eine weitere anzuzeigen */
  tag?: string;
}

export interface PushTarget extends SubscriptionKeys {
  endpoint: string;
}

/** gone: Abo existiert beim Push-Dienst nicht mehr (404/410) und kann gelöscht werden */
export type SendResult = "ok" | "gone" | "failed";

/** Push-Dienste der Browser; nur an diese wird gesendet (Schutz vor Missbrauch des Workers) */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export function isAllowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  );
}

export async function sendPush(
  target: PushTarget,
  message: PushMessage,
  vapid: VapidJwk,
  urgency: "low" | "normal" | "high" = "normal",
): Promise<SendResult> {
  if (!isAllowedEndpoint(target.endpoint)) return "gone";
  const body = await encryptPayload(target, new TextEncoder().encode(JSON.stringify(message)));
  let res: Response;
  try {
    res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization(vapid, target.endpoint, VAPID_SUBJECT),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "3600",
        Urgency: urgency,
        ...(message.tag
          ? { Topic: message.tag.replaceAll(/[^A-Za-z0-9_-]/g, "").slice(0, 32) }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return "failed";
  }
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "ok" : "failed";
}
