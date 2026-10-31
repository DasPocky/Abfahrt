import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "../../worker/security-headers";

const BASE = "https://abfahrt.test";

describe("Worker-API", () => {
  it("GET /api/health liefert ok", async () => {
    const res = await exports.default.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("setzt die Security-Header", async () => {
    const res = await exports.default.fetch(`${BASE}/api/health`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("antwortet auf unbekannte Pfade mit 404", async () => {
    const res = await exports.default.fetch(`${BASE}/api/gibt-es-nicht`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("lehnt schreibende Methoden ab", async () => {
    const res = await exports.default.fetch(`${BASE}/api/health`, { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});

describe("Cache-Probe", () => {
  it("meldet erst miss, dann hit", async () => {
    const first = await exports.default.fetch(`${BASE}/api/cache-probe`);
    expect(await first.json()).toMatchObject({ cache: "miss" });
    const second = await exports.default.fetch(`${BASE}/api/cache-probe`);
    expect(await second.json()).toMatchObject({ cache: "hit" });
  });
});
