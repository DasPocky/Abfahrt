// Geräteprofil (Favoriten und Einstellungen zum Mitnehmen auf ein weiteres Gerät)
//   POST profile/create    → neues Profil mit den mitgeschickten Daten: { id, token, updatedAt }
//   GET  profile           → Daten des Profils (Authorization: Bearer <id>.<token>)
//   PUT  profile           → Daten ersetzen, die jüngste Änderung gewinnt
//   POST profile/transfer  → Übertragen-Code (8 Zeichen, 10 Minuten, einmalig)
//   POST profile/claim     → Code einlösen: { id, token, data, updatedAt }
// Schreibende Anfragen nur als JSON von der eigenen Herkunft. Codes und Schlüssel nur als Hash;
// jedes Gerät hat einen eigenen Schlüssel (profile_keys), so teilen sich Geräte ein Profil.
import { apiError, json } from "./http";

export const PROFILE_ROUTES: ReadonlySet<string> = new Set([
  "profile",
  "profile/create",
  "profile/transfer",
  "profile/claim",
]);

/** Höchstens so viele Zeichen Profildaten (Favoriten und Einstellungen) */
export const MAX_PROFILE_BYTES = 16_384;
/** So lange gilt ein Übertragen-Code */
export const TRANSFER_MS = 10 * 60_000;
/** Zeichen der Codes: ohne leicht verwechselbare (0/O, 1/I/L) */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}
export function newTransferCode(): string {
  // Rejection Sampling, damit jedes Zeichen gleich wahrscheinlich ist
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 256 - (256 % CODE_ALPHABET.length) && code.length < CODE_LENGTH) {
        code += CODE_ALPHABET[b % CODE_ALPHABET.length];
      }
    }
  }
  return code;
}
/** Eingabe vereinheitlichen: Groß, ohne Leer- und Bindestriche */
export const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Profildaten: Objekt mit den gespeicherten Texten von Favoriten und Einstellungen */
export function parseProfileData(value: unknown): { favorites: string; settings: string } | null {
  if (!isRecord(value)) return null;
  const { favorites, settings } = value;
  if (typeof favorites !== "string" || typeof settings !== "string") return null;
  if (favorites.length + settings.length > MAX_PROFILE_BYTES) return null;
  return { favorites, settings };
}

async function readJson(request: Request): Promise<unknown> {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) throw new Error("forbidden_origin");
  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) {
    throw new Error("invalid_body");
  }
  const text = await request.text();
  if (text.length > MAX_PROFILE_BYTES + 1024) throw new Error("invalid_body");
  return JSON.parse(text);
}

interface ProfileRow {
  id: string;
  data: string;
  updated_at: number;
}

/**
 * Profil aus „Authorization: Bearer <id>.<token>“; unbekannt oder falscher Schlüssel: null.
 * Gesucht wird über den Hash des Schlüssels (kein Vergleich von Geheimnissen im Code).
 */
async function authorized(request: Request, db: D1Database): Promise<ProfileRow | null> {
  const match = /^Bearer ([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{32,64})$/.exec(
    request.headers.get("Authorization") ?? "",
  );
  if (!match) return null;
  const [, id, token] = match;
  return db
    .prepare(
      "SELECT p.id, p.data, p.updated_at FROM profile_keys k JOIN profiles p ON p.id = k.profile_id WHERE k.token_hash = ? AND p.id = ?",
    )
    .bind(await sha256(token ?? ""), id)
    .first<ProfileRow>();
}

/** Neuen Geräteschlüssel für ein Profil anlegen */
async function addKey(db: D1Database, profileId: string, now: number): Promise<string> {
  const token = random(32);
  await db
    .prepare("INSERT INTO profile_keys (token_hash, profile_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), profileId, now)
    .run();
  return token;
}

const methodNotAllowed = (allow: string) =>
  json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: allow } });

export async function handleProfile(
  request: Request,
  env: Env,
  route: string,
  now = Date.now(),
): Promise<Response> {
  const db = env.PUSH_DB;

  if (route === "profile" && request.method === "GET") {
    const row = await authorized(request, db);
    if (!row) return apiError(404, "profile_not_found", "Profil nicht gefunden");
    await db.prepare("UPDATE profiles SET seen_at = ? WHERE id = ?").bind(now, row.id).run();
    return json({ data: JSON.parse(row.data), updatedAt: row.updated_at });
  }

  const allow = route === "profile" ? "GET, PUT" : "POST";
  if (route === "profile" ? request.method !== "PUT" : request.method !== "POST") {
    return methodNotAllowed(allow);
  }
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (err) {
    return err instanceof Error && err.message === "forbidden_origin"
      ? apiError(403, "forbidden_origin", "Nur aus der App heraus erlaubt")
      : apiError(400, "invalid_body", "JSON mit höchstens 16 KB erwartet");
  }

  switch (route) {
    case "profile/create": {
      const data = parseProfileData(isRecord(body) ? body.data : null);
      if (!data) return apiError(400, "invalid_profile", "Ungültige Profildaten");
      const id = random(16);
      await db
        .prepare(
          "INSERT INTO profiles (id, data, created_at, updated_at, seen_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, JSON.stringify(data), now, now, now)
        .run();
      return json({ id, token: await addKey(db, id, now), updatedAt: now });
    }
    case "profile": {
      const row = await authorized(request, db);
      if (!row) return apiError(404, "profile_not_found", "Profil nicht gefunden");
      const data = parseProfileData(isRecord(body) ? body.data : null);
      if (!data) return apiError(400, "invalid_profile", "Ungültige Profildaten");
      await db
        .prepare("UPDATE profiles SET data = ?, updated_at = ?, seen_at = ? WHERE id = ?")
        .bind(JSON.stringify(data), now, now, row.id)
        .run();
      return json({ updatedAt: now });
    }
    case "profile/transfer": {
      const row = await authorized(request, db);
      if (!row) return apiError(404, "profile_not_found", "Profil nicht gefunden");
      const code = newTransferCode();
      const expiresAt = now + TRANSFER_MS;
      // Ein neuer Code ersetzt den alten; abgelaufene räumen wir gleich mit weg
      await db.batch([
        db
          .prepare("DELETE FROM profile_transfers WHERE profile_id = ? OR expires_at < ?")
          .bind(row.id, now),
        db
          .prepare(
            "INSERT INTO profile_transfers (code_hash, profile_id, expires_at) VALUES (?, ?, ?)",
          )
          .bind(await sha256(code), row.id, expiresAt),
      ]);
      return json({ code, expiresAt });
    }
    case "profile/claim": {
      const code = normalizeCode(isRecord(body) && typeof body.code === "string" ? body.code : "");
      const invalid = apiError(404, "invalid_code", "Code unbekannt oder abgelaufen");
      if (code.length !== CODE_LENGTH) return invalid;
      // Einmalig: der Code wird beim Einlösen gelöscht
      const transfer = await db
        .prepare(
          "DELETE FROM profile_transfers WHERE code_hash = ? AND expires_at >= ? RETURNING profile_id",
        )
        .bind(await sha256(code), now)
        .first<{ profile_id: string }>();
      if (!transfer) return invalid;
      // Das neue Gerät bekommt einen eigenen Schlüssel; der des alten gilt weiter (beide teilen das Profil)
      const row = await db
        .prepare("SELECT data, updated_at FROM profiles WHERE id = ?")
        .bind(transfer.profile_id)
        .first<{ data: string; updated_at: number }>();
      if (!row) return invalid;
      return json({
        id: transfer.profile_id,
        token: await addKey(db, transfer.profile_id, now),
        data: JSON.parse(row.data),
        updatedAt: row.updated_at,
      });
    }
    default:
      return apiError(404, "not_found");
  }
}
