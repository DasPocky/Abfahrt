import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import { handleProfile, MAX_PROFILE_BYTES, TRANSFER_MS } from "../../worker/profile";

const API = `https://endlab.test${API_PREFIX}`;
const DATA = { favorites: '{"version":2,"items":[]}', settings: '{"theme":"system"}' };

let ip = 0;
function call(route: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return exports.default.fetch(`${API}${route}`, {
    method,
    headers: {
      "CF-Connecting-IP": `10.4.0.${++ip}`,
      "Content-Type": "application/json",
      Origin: "https://endlab.test",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const auth = (p: { id: string; token: string }) => ({ Authorization: `Bearer ${p.id}.${p.token}` });

async function create(data = DATA) {
  const res = await call("profile/create", "POST", { data });
  expect(res.status).toBe(200);
  return res.json<{ id: string; token: string; updatedAt: number }>();
}
async function transfer(p: { id: string; token: string }) {
  const res = await call("profile/transfer", "POST", {}, auth(p));
  expect(res.status).toBe(200);
  return res.json<{ code: string; expiresAt: number }>();
}

/** Anfrage direkt an handleProfile (mit eigener Uhrzeit) */
const req = (route: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${API}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://endlab.test", ...headers },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  await applyD1Migrations(env.PUSH_DB, env.TEST_MIGRATIONS ?? []);
});
beforeEach(() => resetRateLimit());

describe("Geräteprofil", () => {
  it("anlegen, lesen und ändern: die Daten kommen unverändert zurück", async () => {
    const p = await create();
    const got = await call("profile", "GET", undefined, auth(p));
    expect(await got.json()).toMatchObject({ data: DATA });
    const next = { ...DATA, settings: '{"theme":"dark"}' };
    expect((await call("profile", "PUT", { data: next }, auth(p))).status).toBe(200);
    expect(await (await call("profile", "GET", undefined, auth(p))).json()).toMatchObject({
      data: next,
    });
  });

  it("ohne gültigen Schlüssel: nichts lesen, nichts ändern, keine Codes", async () => {
    const p = await create();
    const fremd = { id: p.id, token: "x".repeat(43) };
    expect((await call("profile", "GET", undefined, auth(fremd))).status).toBe(404);
    expect((await call("profile", "PUT", { data: DATA }, auth(fremd))).status).toBe(404);
    expect((await call("profile/transfer", "POST", {}, auth(fremd))).status).toBe(404);
    expect((await call("profile", "GET")).status).toBe(404);
  });

  it("schreibende Anfragen nur von der eigenen Herkunft", async () => {
    const res = await call(
      "profile/create",
      "POST",
      { data: DATA },
      { Origin: "https://fremd.test" },
    );
    expect(res.status).toBe(403);
  });

  it("zu große oder falsch geformte Daten werden abgelehnt", async () => {
    const big = { favorites: "x".repeat(MAX_PROFILE_BYTES), settings: "y" };
    expect((await call("profile/create", "POST", { data: big })).status).not.toBe(200);
    expect((await call("profile/create", "POST", { data: { favorites: 1 } })).status).toBe(400);
  });

  it("Übertragen: Code einlösen gibt dem neuen Gerät die Daten und einen eigenen Schlüssel", async () => {
    const alt = await create();
    const { code } = await transfer(alt);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    const res = await call("profile/claim", "POST", {
      code: code.toLowerCase().replace(/(.{4})/, "$1-"),
    });
    expect(res.status).toBe(200);
    const neu = await res.json<{ id: string; token: string; data: unknown }>();
    expect(neu.id).toBe(alt.id);
    expect(neu.token).not.toBe(alt.token);
    expect(neu.data).toEqual(DATA);
    // Beide Geräte teilen das Profil: eine Änderung vom neuen ist beim alten zu sehen
    const next = { ...DATA, favorites: '{"version":2,"items":[{"stopId":"a","name":"A"}]}' };
    await call("profile", "PUT", { data: next }, auth(neu));
    expect(await (await call("profile", "GET", undefined, auth(alt))).json()).toMatchObject({
      data: next,
    });
  });

  it("ein Code gilt nur einmal", async () => {
    const { code } = await transfer(await create());
    expect((await call("profile/claim", "POST", { code })).status).toBe(200);
    expect((await call("profile/claim", "POST", { code })).status).toBe(404);
  });

  it("ein Code verfällt nach 10 Minuten", async () => {
    const p = await create();
    const t0 = Date.now();
    const made = await handleProfile(
      req("profile/transfer", {}, auth(p)),
      env,
      "profile/transfer",
      t0,
    );
    const { code } = await made.json<{ code: string }>();
    const late = await handleProfile(
      req("profile/claim", { code }),
      env,
      "profile/claim",
      t0 + TRANSFER_MS + 1,
    );
    expect(late.status).toBe(404);
  });

  it("ein neuer Code ersetzt den alten", async () => {
    const p = await create();
    const first = await transfer(p);
    await transfer(p);
    expect((await call("profile/claim", "POST", { code: first.code })).status).toBe(404);
  });

  it("falsche Methoden: 405", async () => {
    expect((await call("profile/create", "GET")).status).toBe(405);
    expect((await call("profile", "POST", { data: DATA })).status).toBe(405);
  });
});
