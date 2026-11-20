// Geräteprofil im Browser: Favoriten und Einstellungen auf ein weiteres Gerät mitnehmen.
// Ohne Profil verlässt nichts das Gerät. Mit Profil gleicht die App beim Start und nach jeder
// Änderung ab; die jüngste Änderung gewinnt. Schlüssel und Kennung liegen nur in diesem Browser.
import { API_PREFIX, BASE_PATH } from "../../shared/base-path";
import { getFavorites, parseFavorites, serializeFavorites, setFavorites } from "@/lib/favorites";
import { getSettings, parseSettings, serializeSettings, setSettings } from "@/lib/settings";

export const PROFILE_KEY = "abfahrt:profile";

export interface StoredProfile {
  id: string;
  token: string;
  /** Stand des Servers beim letzten Abgleich (ms) */
  syncedAt: number;
}

export interface ProfileData {
  favorites: string;
  settings: string;
}

export class ProfileError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getProfile(): StoredProfile | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    if (
      isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.token === "string" &&
      typeof value.syncedAt === "number"
    ) {
      return { id: value.id, token: value.token, syncedAt: value.syncedAt };
    }
  } catch {
    // kaputt oder gesperrt: wie kein Profil
  }
  return null;
}

function storeProfile(profile: StoredProfile | null): void {
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // privater Modus: dann eben ohne Profil
  }
}

/** Was mitgenommen wird: Favoriten und Einstellungen, so wie sie im Browser gespeichert sind */
export function localData(): ProfileData {
  return {
    favorites: serializeFavorites(getFavorites()),
    settings: serializeSettings(getSettings()),
  };
}

let applying = false;
/** Wird gerade ein Stand vom Server übernommen? Dann nicht sofort zurückschicken. */
export const isApplying = () => applying;

function applyData(data: unknown): void {
  if (!isRecord(data) || typeof data.favorites !== "string" || typeof data.settings !== "string") {
    return;
  }
  applying = true;
  try {
    setFavorites(parseFavorites(data.favorites));
    setSettings(parseSettings(data.settings));
  } finally {
    applying = false;
  }
}

async function request(
  route: string,
  method: string,
  body?: unknown,
  profile?: StoredProfile,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (profile) headers.Authorization = `Bearer ${profile.id}.${profile.token}`;
  const res = await fetch(`${API_PREFIX}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ProfileError(
      res.status,
      isRecord(json) && typeof json.error === "string" ? json.error : "http_error",
    );
  }
  return isRecord(json) ? json : {};
}

/** Kennt der Server das Profil nicht mehr (gelöscht), wird es hier vergessen */
function forgetIfGone(err: unknown): never {
  if (err instanceof ProfileError && err.status === 404) storeProfile(null);
  throw err;
}

/** Code zum Übertragen holen; legt beim ersten Mal das Profil mit den Daten dieses Geräts an */
export async function startTransfer(): Promise<{ code: string; expiresAt: number }> {
  let profile = getProfile();
  if (!profile) {
    const created = await request("profile/create", "POST", { data: localData() });
    if (typeof created.id !== "string" || typeof created.token !== "string") {
      throw new ProfileError(500, "invalid_response");
    }
    profile = { id: created.id, token: created.token, syncedAt: Number(created.updatedAt) || 0 };
    storeProfile(profile);
  }
  const res = await request("profile/transfer", "POST", {}, profile).catch(forgetIfGone);
  if (typeof res.code !== "string" || typeof res.expiresAt !== "number") {
    throw new ProfileError(500, "invalid_response");
  }
  return { code: res.code, expiresAt: res.expiresAt };
}

/** Code von einem anderen Gerät einlösen: Favoriten und Einstellungen von dort übernehmen */
export async function claimTransfer(code: string): Promise<void> {
  const res = await request("profile/claim", "POST", { code });
  if (typeof res.id !== "string" || typeof res.token !== "string") {
    throw new ProfileError(500, "invalid_response");
  }
  storeProfile({ id: res.id, token: res.token, syncedAt: Number(res.updatedAt) || 0 });
  applyData(res.data);
}

/** Neueren Stand vom Server übernehmen */
export async function pullProfile(): Promise<void> {
  const profile = getProfile();
  if (!profile) return;
  const res = await request("profile", "GET", undefined, profile).catch(forgetIfGone);
  const updatedAt = Number(res.updatedAt) || 0;
  if (updatedAt > profile.syncedAt) {
    applyData(res.data);
    storeProfile({ ...profile, syncedAt: updatedAt });
  }
}

/** Stand dieses Geräts zum Server schicken */
export async function pushProfile(): Promise<void> {
  const profile = getProfile();
  if (!profile) return;
  const res = await request("profile", "PUT", { data: localData() }, profile).catch(forgetIfGone);
  storeProfile({ ...profile, syncedAt: Number(res.updatedAt) || profile.syncedAt });
}

/** Dieses Gerät vom Profil lösen (die Daten bleiben hier, der Abgleich endet) */
export function leaveProfile(): void {
  storeProfile(null);
}

/** Link zum Einlösen auf dem anderen Gerät */
export const claimLink = (code: string) =>
  `${location.origin}${BASE_PATH}/profil/uebernehmen/${code}`;

/** Code für die Anzeige: ABCD EFGH */
export const formatCode = (code: string) => code.replace(/^(.{4})(.{4})$/, "$1 $2");
