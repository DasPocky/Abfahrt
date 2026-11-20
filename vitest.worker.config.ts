import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/** Test-Schlüssel für Web Push, nur für die Tests erzeugt (nicht der echte) */
async function testVapidJwk(): Promise<string> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
}

/** Schlüsselpaar für Access-Ausweise in den Tests (nicht der echte von Cloudflare) */
async function testAccessKeys(): Promise<{ jwks: string; key: string }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    jwks: JSON.stringify({ keys: [{ ...pub, kid: "test", alg: "RS256" }] }),
    key: JSON.stringify({ ...priv, kid: "test", alg: "RS256" }),
  };
}

// Tests des Workers in der echten Workers-Runtime (Miniflare); D1 lokal mit den Migrationen
const access = await testAccessKeys();

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Workers AI (Spracheingabe) nicht bei Cloudflare aufrufen; die Tests ersetzen env.AI
      remoteBindings: false,
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
          VAPID_PRIVATE_JWK: await testVapidJwk(),
          ACCESS_TEAM: "team.example.com",
          ACCESS_AUD: "test-aud",
          ACCESS_JWKS: access.jwks,
          TEST_ACCESS_KEY: access.key,
        },
        // EndLab Login als Test-Ersatz (Service Binding LOGIN)
        workers: [
          { name: "endlab-login", modules: true, scriptPath: "./test/worker/login-stub.mjs" },
        ],
      },
    }),
  ],
  test: {
    name: "worker",
    include: ["test/worker/**/*.test.ts"],
  },
}));
