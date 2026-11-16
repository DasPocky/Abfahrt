// Secrets stehen nicht in wrangler.jsonc und fehlen daher in worker-configuration.d.ts.
// Ergänzt für `Env` (Worker-Handler) und `Cloudflare.Env` (`env` aus "cloudflare:workers").
interface Env {
  /** Privater VAPID-Schlüssel (JWK), angelegt vom Workflow push-setup */
  VAPID_PRIVATE_JWK?: string;
}

declare namespace Cloudflare {
  interface Env {
    VAPID_PRIVATE_JWK?: string;
  }
}
