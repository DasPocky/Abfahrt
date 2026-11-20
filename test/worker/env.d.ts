// Nur in den Tests vorhandene Bindungen (siehe vitest.worker.config.ts)
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS?: import("cloudflare:test").D1Migration[];
    /** Privater Schlüssel (JWK) zum Signieren von Test-Ausweisen für Access */
    TEST_ACCESS_KEY?: string;
  }
}
