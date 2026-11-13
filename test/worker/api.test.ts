import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import { SECURITY_HEADERS } from "../../worker/security-headers";

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

describe("Basis-Pfad", () => {
  it("leitet /abfahrt auf /abfahrt/ weiter", async () => {
    const res = await exports.default.fetch("https://endlab.test/abfahrt?x=1", {
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://endlab.test/abfahrt/?x=1");
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
