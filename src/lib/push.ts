// Web Push in der App (#71): Zustand ermitteln, abonnieren, abbestellen, Testnachricht
import { API_PREFIX, BASE_PATH } from "../../shared/base-path";

export type PushState =
  /** Browser kann kein Push */
  | "unsupported"
  /** iPhone/iPad im Browser: Push nur in der installierten App (Homescreen) */
  | "ios-browser"
  /** Benachrichtigungen im Browser blockiert */
  | "denied"
  | "off"
  | "on";

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration(`${BASE_PATH}/`)) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  return (await registration())?.pushManager.getSubscription() ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "ios-browser" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

/** Erlaubnis anfragen (muss aus einem Antippen heraus passieren), abonnieren, beim Worker speichern */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  if (!reg) throw new Error("Service Worker fehlt");
  const keyRes = await fetch(`${API_PREFIX}push/key`, { headers: { Accept: "application/json" } });
  const keyBody: unknown = await keyRes.json().catch(() => null);
  if (
    !keyRes.ok ||
    typeof keyBody !== "object" ||
    keyBody === null ||
    !("publicKey" in keyBody) ||
    typeof keyBody.publicKey !== "string"
  ) {
    throw new Error("Push ist gerade nicht eingerichtet");
  }
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(keyBody.publicKey),
    }));
  const res = await postJson("push/subscribe", { subscription: subscription.toJSON() });
  if (!res.ok) throw new Error("Abo konnte nicht gespeichert werden");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    await postJson("push/unsubscribe", { subscription: subscription.toJSON() }).catch(() => null);
    await subscription.unsubscribe();
  }
  return "off";
}

export async function sendTestPush(): Promise<boolean> {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  const res = await postJson("push/test", { subscription: subscription.toJSON() });
  return res.ok;
}
