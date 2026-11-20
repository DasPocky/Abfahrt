// Verwaltung (nur für die EndLab-Verwaltung):
//   GET  verwaltung/stand            → Nutzung, Push, Sprachsuche, Banner, Profile in Zahlen
//   PUT  verwaltung/banner           → { text } setzt den Hinweis für alle (leer: weg)
//   PUT  verwaltung/sprache          → { minutes } Tagesgrenze der Sprachsuche
//   GET  verwaltung/profile          → Geräteprofile (ohne Inhalte)
//   POST verwaltung/profile/loeschen → { id } Profil samt Schlüsseln und Codes löschen
//   POST verwaltung/codes/zurueckziehen → { id? } offene Übertragen-Codes zurückziehen
// Öffentlich: GET banner → { text } (oder null).
//
// Zugang in zwei Stufen: Cloudflare Access (Anmeldung über EndLab Login) steht vor
// /verwaltung und /api/verwaltung und schickt einen signierten Ausweis mit. Der Worker prüft
// ihn selbst – fällt Access weg, steht nichts offen – und fragt EndLab Login, ob die Person bei
// „Abfahrt“ die Rolle „verwaltung“ hat.
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { apiError, json } from "./http";

export const ADMIN_ROUTES: ReadonlySet<string> = new Set([
  "verwaltung/stand",
  "verwaltung/banner",
  "verwaltung/sprache",
  "verwaltung/profile",
  "verwaltung/profile/loeschen",
  "verwaltung/codes/zurueckziehen",
]);

/** Längster Hinweistext */
export const MAX_BANNER = 200;
/** Spanne der Tagesgrenze der Sprachsuche (Minuten) */
export const SPEECH_MINUTES_MAX = 600;

// --- Einstellungen ---

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM admin_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function setSetting(db: D1Database, key: string, value: string | null, now: number) {
  if (value === null) {
    await db.prepare("DELETE FROM admin_settings WHERE key = ?").bind(key).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

/** Tagesgrenze der Sprachsuche: aus der Verwaltung, sonst aus der Konfiguration */
export async function speechDailyMinutes(env: Env): Promise<number> {
  const stored = Number(await getSetting(env.PUSH_DB, "speech_daily_minutes").catch(() => null));
  return Number.isFinite(stored) && stored > 0 ? stored : Number(env.SPEECH_DAILY_MINUTES) || 0;
}

/** Öffentlicher Hinweis für alle (z. B. Bauarbeiten) */
export async function handleBanner(env: Env): Promise<Response> {
  const text = await getSetting(env.PUSH_DB, "banner").catch(() => null);
  return json({ text: text || null }, { headers: { "Cache-Control": "public, max-age=60" } });
}

// --- Zugang ---

const remote = new Map<string, JWTVerifyGetKey>();
function keys(env: Env): JWTVerifyGetKey {
  if (env.ACCESS_JWKS) return createLocalJWKSet(JSON.parse(env.ACCESS_JWKS));
  const team = env.ACCESS_TEAM ?? "";
  let k = remote.get(team);
  if (!k) {
    k = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
    remote.set(team, k);
  }
  return k;
}

/** E-Mail aus dem Access-Ausweis, wenn er gültig ist; sonst null */
async function accessEmail(request: Request, env: Env): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_AUD || !env.ACCESS_TEAM) return null;
  try {
    const { payload } = await jwtVerify(token, keys(env), {
      issuer: `https://${env.ACCESS_TEAM}`,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    return typeof payload.email === "string" && payload.email ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Auskunft von EndLab Login (interne Schnittstelle „Intern“), nur der hier genutzte Teil */
interface LoginIntern {
  konto(email: string): Promise<{ apps: Partial<Record<string, string>> } | null>;
}
function isLoginIntern(value: unknown): value is LoginIntern {
  return typeof value === "object" && value !== null && "konto" in value;
}

/** Darf diese Anfrage verwalten? Ausweis gültig und bei EndLab Login Rolle „verwaltung“ */
export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const email = await accessEmail(request, env);
  const login: unknown = env.LOGIN;
  if (!email || !isLoginIntern(login)) return false;
  try {
    const konto = await login.konto(email);
    return konto?.apps.abfahrt === "verwaltung";
  } catch {
    return false;
  }
}

// --- Schnittstelle ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return null;
  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) return null;
  const text = await request.text();
  if (text.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

const count = async (db: D1Database, sql: string, ...args: unknown[]) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .first<{ n: number }>()
  )?.n ?? 0;

export async function handleAdmin(
  request: Request,
  env: Env,
  route: string,
  now = Date.now(),
): Promise<Response> {
  if (!(await isAdmin(request, env))) {
    return apiError(403, "forbidden", "Nur für die Verwaltung von Abfahrt");
  }
  const db = env.PUSH_DB;
  const day = 24 * 60 * 60 * 1000;

  if (request.method === "GET") {
    if (route === "verwaltung/stand") {
      const today = new Date(now).toISOString().slice(0, 10);
      const weekAgo = new Date(now - 6 * day).toISOString().slice(0, 10);
      const speechToday = await db
        .prepare("SELECT seconds, requests FROM speech_usage WHERE day = ?")
        .bind(today)
        .first<{ seconds: number; requests: number }>();
      const speechWeek = await db
        .prepare(
          "SELECT COALESCE(SUM(seconds), 0) AS seconds, COALESCE(SUM(requests), 0) AS requests FROM speech_usage WHERE day >= ?",
        )
        .bind(weekAgo)
        .first<{ seconds: number; requests: number }>();
      return json({
        push: {
          abos: await count(db, "SELECT COUNT(*) AS n FROM push_subscriptions"),
          aktiv7: await count(
            db,
            "SELECT COUNT(*) AS n FROM push_subscriptions WHERE last_success_at >= ?",
            now - 7 * day,
          ),
          fehlerhaft: await count(
            db,
            "SELECT COUNT(*) AS n FROM push_subscriptions WHERE failures > 0",
          ),
        },
        sprache: {
          heuteSekunden: speechToday?.seconds ?? 0,
          heuteAnfragen: speechToday?.requests ?? 0,
          wocheSekunden: speechWeek?.seconds ?? 0,
          wocheAnfragen: speechWeek?.requests ?? 0,
          grenzeMinuten: await speechDailyMinutes(env),
          grenzeStandard: Number(env.SPEECH_DAILY_MINUTES) || 0,
        },
        profile: {
          anzahl: await count(db, "SELECT COUNT(*) AS n FROM profiles"),
          geraete: await count(db, "SELECT COUNT(*) AS n FROM profile_keys"),
          aktiv7: await count(
            db,
            "SELECT COUNT(*) AS n FROM profiles WHERE seen_at >= ?",
            now - 7 * day,
          ),
          offeneCodes: await count(
            db,
            "SELECT COUNT(*) AS n FROM profile_transfers WHERE expires_at >= ?",
            now,
          ),
        },
        banner: (await getSetting(db, "banner")) ?? "",
      });
    }
    if (route === "verwaltung/profile") {
      const { results } = await db
        .prepare(
          `SELECT p.id, p.created_at, p.updated_at, p.seen_at, length(p.data) AS bytes,
                  (SELECT COUNT(*) FROM profile_keys k WHERE k.profile_id = p.id) AS geraete,
                  (SELECT COUNT(*) FROM profile_transfers t WHERE t.profile_id = p.id AND t.expires_at >= ?) AS codes
             FROM profiles p ORDER BY p.seen_at DESC LIMIT 200`,
        )
        .bind(now)
        .all();
      return json({ profile: results });
    }
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const body = await readJson(request);
  if (!body) return apiError(400, "invalid_body", "JSON von der eigenen Seite erwartet");

  switch (`${request.method} ${route}`) {
    case "PUT verwaltung/banner": {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (text.length > MAX_BANNER)
        return apiError(400, "invalid_banner", `Höchstens ${MAX_BANNER} Zeichen`);
      await setSetting(db, "banner", text || null, now);
      return json({ text: text || null });
    }
    case "PUT verwaltung/sprache": {
      const minutes = body.minutes === null ? null : Number(body.minutes);
      if (
        minutes !== null &&
        (!Number.isInteger(minutes) || minutes < 0 || minutes > SPEECH_MINUTES_MAX)
      ) {
        return apiError(400, "invalid_minutes", `0 bis ${SPEECH_MINUTES_MAX} Minuten`);
      }
      // null: zurück zum Wert aus der Konfiguration
      await setSetting(db, "speech_daily_minutes", minutes === null ? null : String(minutes), now);
      return json({ minutes: await speechDailyMinutes(env) });
    }
    case "POST verwaltung/profile/loeschen": {
      if (typeof body.id !== "string") return apiError(400, "invalid_id", "Profil fehlt");
      await db.batch([
        db.prepare("DELETE FROM profile_transfers WHERE profile_id = ?").bind(body.id),
        db.prepare("DELETE FROM profile_keys WHERE profile_id = ?").bind(body.id),
        db.prepare("DELETE FROM profiles WHERE id = ?").bind(body.id),
      ]);
      return json({ status: "deleted" });
    }
    case "POST verwaltung/codes/zurueckziehen": {
      const result =
        typeof body.id === "string"
          ? await db
              .prepare("DELETE FROM profile_transfers WHERE profile_id = ?")
              .bind(body.id)
              .run()
          : await db.prepare("DELETE FROM profile_transfers").run();
      return json({ removed: result.meta.changes ?? 0 });
    }
    default:
      return json({ error: "method_not_allowed" }, { status: 405 });
  }
}
