// Secrets stehen nicht in wrangler.jsonc und fehlen daher in worker-configuration.d.ts.
// Ergänzt für `Env` (Worker-Handler) und `Cloudflare.Env` (`env` aus "cloudflare:workers").
interface Env {
  /** Privater VAPID-Schlüssel (JWK), Worker-Secret */
  VAPID_PRIVATE_JWK?: string;
  /** Nur in Tests: öffentliche Schlüssel für Access-Ausweise statt der echten von Cloudflare */
  ACCESS_JWKS?: string;
}

declare namespace Cloudflare {
  interface Env {
    VAPID_PRIVATE_JWK?: string;
    ACCESS_JWKS?: string;
  }
}
