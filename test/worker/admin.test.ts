import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { importJWK, SignJWT, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";

const API = `https://endlab.test${API_PREFIX}`;

function isJwk(value: unknown): value is JWK {
  return typeof value === "object" && value !== null && "kty" in value;
}

/** Access-Ausweis wie von Cloudflare, signiert mit dem Testschlüssel */
async function ausweis(email: string, aud = "test-aud", iss = "https://team.example.com") {
  const jwk: unknown = JSON.parse(env.TEST_ACCESS_KEY ?? "{}");
  if (!isJwk(jwk)) throw new Error("Testschlüssel fehlt");
  const key = await importJWK(jwk, "RS256");
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

let ip = 0;
async function call(route: string, method = "GET", body?: unknown, token?: string) {
  const headers: Record<string, string> = { "CF-Connecting-IP": `10.5.0.${++ip}` };
  if (token) headers["Cf-Access-Jwt-Assertion"] = token;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Origin = "https://endlab.test";
  }
  return exports.default.fetch(`${API}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.PUSH_DB, env.TEST_MIGRATIONS ?? []);
});
beforeEach(() => resetRateLimit());

describe("Verwaltung: Zugang", () => {
  it("ohne Ausweis kein Zugang", async () => {
    expect((await call("verwaltung/stand")).status).toBe(403);
  });

  it("nur mit Rolle „verwaltung“ bei Abfahrt", async () => {
    expect(
      (await call("verwaltung/stand", "GET", undefined, await ausweis("nutzer@example.com")))
        .status,
    ).toBe(403);
    expect(
      (await call("verwaltung/stand", "GET", undefined, await ausweis("fremd@example.com"))).status,
    ).toBe(403);
    expect(
      (await call("verwaltung/stand", "GET", undefined, await ausweis("unbekannt@example.com")))
        .status,
    ).toBe(403);
    expect(
      (await call("verwaltung/stand", "GET", undefined, await ausweis("verwaltung@example.com")))
        .status,
    ).toBe(200);
  });

  it("Ausweis für eine andere Anwendung oder einen anderen Aussteller gilt nicht", async () => {
    expect(
      (
        await call(
          "verwaltung/stand",
          "GET",
          undefined,
          await ausweis("verwaltung@example.com", "andere-aud"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "verwaltung/stand",
          "GET",
          undefined,
          await ausweis("verwaltung@example.com", "test-aud", "https://boese.example.com"),
        )
      ).status,
    ).toBe(403);
  });
});

describe("Verwaltung: Funktionen", () => {
  it("Banner setzen, öffentlich lesen und wieder entfernen", async () => {
    const t = await ausweis("verwaltung@example.com");
    expect((await call("verwaltung/banner", "PUT", { text: "Bauarbeiten am Hbf" }, t)).status).toBe(
      200,
    );
    expect(await (await call("banner")).json()).toEqual({ text: "Bauarbeiten am Hbf" });
    await call("verwaltung/banner", "PUT", { text: "" }, t);
    expect(await (await call("banner")).json()).toEqual({ text: null });
    expect((await call("verwaltung/banner", "PUT", { text: "x".repeat(201) }, t)).status).toBe(400);
  });

  it("Tagesgrenze der Sprachsuche ändern und zurücksetzen", async () => {
    const t = await ausweis("verwaltung@example.com");
    expect(await (await call("verwaltung/sprache", "PUT", { minutes: 30 }, t)).json()).toEqual({
      minutes: 30,
    });
    const stand = await (
      await call("verwaltung/stand", "GET", undefined, t)
    ).json<{ sprache: { grenzeMinuten: number } }>();
    expect(stand.sprache.grenzeMinuten).toBe(30);
    expect((await call("verwaltung/sprache", "PUT", { minutes: -1 }, t)).status).toBe(400);
    const zurueck = await (
      await call("verwaltung/sprache", "PUT", { minutes: null }, t)
    ).json<{ minutes: number }>();
    expect(zurueck.minutes).toBe(Number(env.SPEECH_DAILY_MINUTES));
  });

  it("Profile sehen, Codes zurückziehen und Profil löschen", async () => {
    const t = await ausweis("verwaltung@example.com");
    const created = await call("profile/create", "POST", {
      data: { favorites: "{}", settings: "{}" },
    });
    const p = await created.json<{ id: string; token: string }>();
    await exports.default.fetch(`${API}profile/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://endlab.test",
        Authorization: `Bearer ${p.id}.${p.token}`,
      },
      body: "{}",
    });
    const liste = await (
      await call("verwaltung/profile", "GET", undefined, t)
    ).json<{ profile: { id: string; codes: number }[] }>();
    expect(liste.profile.find((x) => x.id === p.id)?.codes).toBe(1);
    expect(
      await (await call("verwaltung/codes/zurueckziehen", "POST", { id: p.id }, t)).json(),
    ).toEqual({ removed: 1 });
    expect((await call("verwaltung/profile/loeschen", "POST", { id: p.id }, t)).status).toBe(200);
    const nachher = await exports.default.fetch(`${API}profile`, {
      headers: { Authorization: `Bearer ${p.id}.${p.token}` },
    });
    expect(nachher.status).toBe(404);
  });

  it("schreibende Anfragen der Verwaltung nur von der eigenen Herkunft", async () => {
    const res = await exports.default.fetch(`${API}verwaltung/banner`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://boese.example.com",
        "Cf-Access-Jwt-Assertion": await ausweis("verwaltung@example.com"),
      },
      body: JSON.stringify({ text: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
