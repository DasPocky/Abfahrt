import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import {
  base64UrlDecode,
  base64UrlEncode,
  encryptPayload,
  parseVapidJwk,
  vapidAuthorization,
  vapidPublicKey,
} from "../../worker/push/crypto";
import { isAllowedEndpoint } from "../../worker/push/send";
import { resetRateLimit } from "../../worker/rate-limit";

const API = `https://endlab.test${API_PREFIX}`;
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

/** Browser-Seite eines Abos: ECDH-Schlüssel und Auth-Geheimnis */
async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  if (!("privateKey" in pair)) throw new Error("Schlüsselpaar erwartet");
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  if (!(raw instanceof ArrayBuffer)) throw new Error("ArrayBuffer erwartet");
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    pair,
    keys: { p256dh: base64UrlEncode(new Uint8Array(raw)), auth: base64UrlEncode(auth) },
  };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
  );
}

/** Entschlüsseln wie der Browser (RFC 8291), um die Verschlüsselung unabhängig zu prüfen */
async function decrypt(body: Uint8Array, browser: Awaited<ReturnType<typeof browserKeys>>) {
  const salt = body.slice(0, 16);
  const idlen = body[20] ?? 0;
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = { name: "ECDH", public: asKey, $public: asKey };
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, browser.pair.privateKey, 256));
  const enc = new TextEncoder();
  const uaPublic = base64UrlDecode(browser.keys.p256dh);
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(base64UrlDecode(browser.keys.auth), shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
  );
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

let ip = 0;
function post(route: string, body: unknown, headers: Record<string, string> = {}) {
  return exports.default.fetch(`${API}${route}`, {
    method: "POST",
    headers: {
      "CF-Connecting-IP": `10.3.0.${++ip}`,
      "Content-Type": "application/json",
      Origin: "https://endlab.test",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.PUSH_DB, env.TEST_MIGRATIONS ?? []);
});
beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("Web-Push-Krypto", () => {
  it("verschlüsselt so, dass der Browser die Nachricht lesen kann (RFC 8291)", async () => {
    const browser = await browserKeys();
    const body = await encryptPayload(browser.keys, new TextEncoder().encode('{"title":"Test"}'));
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(await decrypt(body, browser)).toBe('{"title":"Test"}');
  });

  it("signiert das VAPID-Token mit ES256 für die Herkunft des Push-Dienstes", async () => {
    const jwk = parseVapidJwk(env.VAPID_PRIVATE_JWK);
    expect(jwk).not.toBeNull();
    if (!jwk) return;
    const header = await vapidAuthorization(jwk, ENDPOINT, "https://endlab.de/abfahrt", 0);
    const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? [];
    expect(key).toBe(vapidPublicKey(jwk));
    const [h, c, s] = (token ?? "").split(".");
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(c ?? "")))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 12 * 60 * 60,
      sub: "https://endlab.de/abfahrt",
    });
    const publicKey = await crypto.subtle.importKey(
      "raw",
      base64UrlDecode(key ?? ""),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlDecode(s ?? ""),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });

  it("sendet nur an bekannte Push-Dienste", () => {
    expect(isAllowedEndpoint(ENDPOINT)).toBe(true);
    expect(isAllowedEndpoint("https://web.push.apple.com/QAbc")).toBe(true);
    expect(isAllowedEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isAllowedEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
  });
});

describe("API push", () => {
  it("liefert den öffentlichen Schlüssel", async () => {
    const res = await exports.default.fetch(`${API}push/key`);
    expect(res.status).toBe(200);
    const body = await res.json<{ publicKey: string }>();
    expect(base64UrlDecode(body.publicKey)).toHaveLength(65);
  });

  it("speichert ein Abo, sendet eine Testnachricht und löscht es wieder", async () => {
    const browser = await browserKeys();
    const subscription = { endpoint: ENDPOINT, keys: browser.keys };
    expect((await post("push/subscribe", { subscription })).status).toBe(200);
    const row = await env.PUSH_DB.prepare("SELECT endpoint FROM push_subscriptions").first();
    expect(row).toEqual({ endpoint: ENDPOINT });

    // Anfrage an den Push-Dienst im Mock lesen (Bodies lassen sich nicht über Kontexte teilen)
    const sent: { url: string; headers: Headers; body: Uint8Array }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      sent.push({
        url: request.url,
        headers: request.headers,
        body: new Uint8Array(await request.arrayBuffer()),
      });
      return new Response(null, { status: 201 });
    });
    const res = await post("push/test", { subscription });
    expect(res.status).toBe(200);
    const [request] = sent;
    expect(request?.url).toBe(ENDPOINT);
    expect(request?.headers.get("Content-Encoding")).toBe("aes128gcm");
    expect(request?.headers.get("Authorization")).toMatch(/^vapid t=/);
    const message: unknown = JSON.parse(await decrypt(request?.body ?? new Uint8Array(), browser));
    expect(message).toMatchObject({ title: "Abfahrt", url: "/abfahrt/" });
    vi.restoreAllMocks();

    expect((await post("push/unsubscribe", { subscription })).status).toBe(200);
    expect(
      await env.PUSH_DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first(),
    ).toEqual({ n: 0 });
  });

  it("löscht Abos, die der Push-Dienst nicht mehr kennt", async () => {
    const browser = await browserKeys();
    const subscription = { endpoint: `${ENDPOINT}-weg`, keys: browser.keys };
    await post("push/subscribe", { subscription });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(null, { status: 410 }),
    );
    expect((await post("push/test", { subscription })).status).toBe(502);
    vi.restoreAllMocks();
    expect(
      await env.PUSH_DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint = ?1")
        .bind(`${ENDPOINT}-weg`)
        .first(),
    ).toEqual({ n: 0 });
  });

  it("lehnt fremde Herkunft, fremde Endpunkte und falsche Methoden ab", async () => {
    const browser = await browserKeys();
    const subscription = { endpoint: ENDPOINT, keys: browser.keys };
    expect(
      (await post("push/subscribe", { subscription }, { Origin: "https://evil.example" })).status,
    ).toBe(403);
    expect(
      (
        await post("push/subscribe", {
          subscription: { endpoint: "https://evil.example/x", keys: browser.keys },
        })
      ).status,
    ).toBe(400);
    expect((await post("push/subscribe", "kein Abo")).status).toBe(400);
    expect((await exports.default.fetch(`${API}push/subscribe`)).status).toBe(405);
    expect((await exports.default.fetch(`${API}departures`, { method: "POST" })).status).toBe(405);
  });
});
