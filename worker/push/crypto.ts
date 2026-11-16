// Web Push ohne Fremdbibliothek: VAPID-Signatur (RFC 8292) und Verschlüsselung der Nachricht
// (RFC 8291, Content-Encoding aes128gcm nach RFC 8188) mit WebCrypto im Worker.

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Privater VAPID-Schlüssel als JWK (P-256), so wie scripts/vapid-keys.mjs ihn ablegt */
export interface VapidJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d: string;
}

export function parseVapidJwk(raw: string | undefined): VapidJwk | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === "object" &&
      data !== null &&
      "kty" in data &&
      data.kty === "EC" &&
      "crv" in data &&
      data.crv === "P-256" &&
      "x" in data &&
      typeof data.x === "string" &&
      "y" in data &&
      typeof data.y === "string" &&
      "d" in data &&
      typeof data.d === "string"
    ) {
      return { kty: "EC", crv: "P-256", x: data.x, y: data.y, d: data.d };
    }
  } catch {
    // ungültiges Secret: wie fehlend behandeln
  }
  return null;
}

/** Öffentlicher Schlüssel (unkomprimierter Punkt 0x04‖x‖y, base64url) für die App */
export function vapidPublicKey(jwk: VapidJwk): string {
  return base64UrlEncode(
    concat(new Uint8Array([4]), base64UrlDecode(jwk.x), base64UrlDecode(jwk.y)),
  );
}

/** VAPID-Header `Authorization: vapid t=<JWT>, k=<öffentlicher Schlüssel>` für einen Push-Dienst */
export async function vapidAuthorization(
  jwk: VapidJwk,
  endpoint: string,
  subject: string,
  now = Date.now(),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        // höchstens 24 h laut RFC 8292; 12 h genügen
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // WebCrypto liefert die Signatur bereits im JWT-Format (r‖s, je 32 Byte)
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${vapidPublicKey(jwk)}`;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
  );
}

/** Schlüssel eines Push-Abos aus `PushSubscription.toJSON().keys` */
export interface SubscriptionKeys {
  /** öffentlicher ECDH-Schlüssel des Browsers (65 Byte, base64url) */
  p256dh: string;
  /** Authentifizierungsgeheimnis (16 Byte, base64url) */
  auth: string;
}

/** Für Tests: festes Salz und fester Server-Schlüssel */
export interface EncryptOptions {
  salt?: Uint8Array;
  serverKeys?: CryptoKeyPair;
}

/** Verschlüsselt die Nachricht für ein Abo (ein Datensatz, aes128gcm) */
export async function encryptPayload(
  keys: SubscriptionKeys,
  payload: Uint8Array,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const uaPublic = base64UrlDecode(keys.p256dh);
  const authSecret = base64UrlDecode(keys.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("invalid_keys");

  const serverKeys =
    options.serverKeys ??
    (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  if (!("privateKey" in serverKeys)) throw new Error("invalid_keys");
  const exported = await crypto.subtle.exportKey("raw", serverKeys.publicKey);
  if (!(exported instanceof ArrayBuffer)) throw new Error("invalid_keys");
  const asPublic = new Uint8Array(exported);
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // Die Workers-Typen nennen das Feld „$public“, die Laufzeit liest (wie im Standard) „public“
  const ecdh = { name: "ECDH", public: uaKey, $public: uaKey };
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, serverKeys.privateKey, 256));

  // RFC 8291, Abschnitt 3.4
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  // Ein Datensatz: Nachricht + Trennzeichen 0x02 (letzter Datensatz), ohne Auffüllung
  const plaintext = concat(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext),
  );

  // Kopf nach RFC 8188: salt(16) ‖ rs(4) ‖ idlen(1) ‖ keyid(65)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}
