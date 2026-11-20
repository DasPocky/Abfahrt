import { createExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import worker from "../../worker/index";
import { PAGE_SECURITY_HEADERS, SECURITY_HEADERS } from "../../worker/security-headers";

const API = `https://endlab.test${API_PREFIX}`;

describe("Worker-API", () => {
  it("GET health liefert ok", async () => {
    const res = await exports.default.fetch(`${API}health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("setzt die Security-Header", async () => {
    const res = await exports.default.fetch(`${API}health`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("antwortet auf unbekannte Pfade mit 404", async () => {
    const res = await exports.default.fetch(`${API}gibt-es-nicht`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("lehnt schreibende Methoden ab", async () => {
    const res = await exports.default.fetch(`${API}health`, { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});

describe("Frühere Adresse /abfahrt", () => {
  const page = { redirect: "manual", headers: { "Sec-Fetch-Mode": "navigate" } } as const;

  it("leitet auf derselben Adresse an die Wurzel um, Pfad und Query bleiben", async () => {
    const res = await exports.default.fetch("https://abfahrt.endlab.de/abfahrt/fahrt?x=1", page);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://abfahrt.endlab.de/fahrt?x=1");
  });

  it("zieht von endlab.de mit einer Umzugsseite nach abfahrt.endlab.de", async () => {
    const res = await exports.default.fetch("https://endlab.de/abfahrt/karte?x=1", page);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toMatch(/script-src 'nonce-/);
    expect(await res.text()).toContain('"https://abfahrt.endlab.de/karte?x=1"');
  });

  it("ersetzt den alten Service Worker durch einen, der sich abmeldet", async () => {
    const res = await exports.default.fetch("https://endlab.de/abfahrt/sw.js");
    expect(await res.text()).toContain("unregister()");
  });

  it("beantwortet /api für offene Tabs weiter", async () => {
    const res = await exports.default.fetch("https://endlab.de/abfahrt/api/health");
    expect(res.status).toBe(200);
  });
});

describe("App-Seiten (#76)", () => {
  // Static Assets gibt es im Testumfeld nicht: ASSETS als Attrappe, die index.html liefert
  const requested: string[] = [];
  const assets: Fetcher = {
    fetch: async (input: RequestInfo | URL) => {
      requested.push(input instanceof Request ? input.url : String(input));
      return new Response('<div id="root"></div>', {
        headers: { "Content-Type": "text/html", "Content-Security-Policy": "alt" },
      });
    },
    connect: () => {
      throw new Error("nicht genutzt");
    },
  };
  const pageEnv: Env = { ...env, ASSETS: assets };

  it.each([
    "/haltestelle/vrr%3Ade%3A05111%3A18036",
    "/verbindung?von=vrr%3Ade%3A05111%3A18036",
    "/fahrt",
  ])("liefert %s als index.html mit den Seiten-Headern aus", async (path) => {
    requested.length = 0;
    const res = await worker.fetch(
      new Request(`https://endlab.test${path}`, { headers: { Accept: "text/html" } }),
      pageEnv,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    expect(requested).toEqual(["https://endlab.test/"]);
    expect(res.headers.get("Content-Security-Policy")).toBe(
      PAGE_SECURITY_HEADERS["Content-Security-Policy"],
    );
    expect(await res.text()).toContain('<div id="root"');
  });
});

describe("Cache-Probe", () => {
  it("meldet erst miss, dann hit", async () => {
    const first = await exports.default.fetch(`${API}cache-probe`);
    expect(await first.json()).toMatchObject({ cache: "miss" });
    const second = await exports.default.fetch(`${API}cache-probe`);
    expect(await second.json()).toMatchObject({ cache: "hit" });
  });
});
