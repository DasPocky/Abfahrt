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

// Tests des Workers in der echten Workers-Runtime (Miniflare); D1 lokal mit den Migrationen
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
        },
      },
    }),
  ],
  test: {
    name: "worker",
    include: ["test/worker/**/*.test.ts"],
  },
}));
