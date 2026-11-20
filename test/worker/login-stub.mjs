// Test-Ersatz für EndLab Login: feste Konten und Freigaben (interne Schnittstelle „Intern“).
import { WorkerEntrypoint } from "cloudflare:workers";

const KONTEN = {
  "verwaltung@example.com": { apps: { abfahrt: "verwaltung" } },
  "nutzer@example.com": { apps: { abfahrt: "nutzer" } },
  "fremd@example.com": { apps: { healthlog: "verwaltung" } },
};

export class Intern extends WorkerEntrypoint {
  async konto(email) {
    return KONTEN[email] ?? null;
  }
}

export default { fetch: () => new Response("EndLab Login (Test)") };
