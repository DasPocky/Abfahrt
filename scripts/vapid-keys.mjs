// Erzeugt ein VAPID-Schlüsselpaar (ECDSA P-256) für Web Push.
// Ausgabe: privater Schlüssel als JWK-JSON in die Datei aus argv[2] (für `wrangler secret put`),
// öffentlicher Schlüssel (unkomprimierter Punkt, base64url) auf stdout. Der private Schlüssel
// wird nie ausgegeben.
import { writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) {
  console.error("Aufruf: node scripts/vapid-keys.mjs <datei-fuer-privaten-schluessel>");
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
writeFileSync(out, JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }), {
  mode: 0o600,
});
process.stdout.write(Buffer.from(raw).toString("base64url"));
