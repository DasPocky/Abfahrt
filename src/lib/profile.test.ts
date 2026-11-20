import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFavorites, serializeFavorites, setFavorites, toFavorite } from "./favorites";
import { getSettings, serializeSettings, DEFAULT_SETTINGS } from "./settings";
import {
  claimTransfer,
  getProfile,
  localData,
  PROFILE_KEY,
  pullProfile,
  pushProfile,
  startTransfer,
} from "./profile";

const HBF = toFavorite({ id: "vrr:de:05111:18235", name: "Düsseldorf Hbf" });
const REMOTE = {
  favorites: serializeFavorites([HBF]),
  settings: serializeSettings({ ...DEFAULT_SETTINGS, favoriteCount: 6 }),
};

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  localStorage.clear();
  setFavorites([]);
});
afterEach(() => vi.restoreAllMocks());

describe("Geräteprofil im Browser", () => {
  it("ohne Profil verlässt nichts das Gerät", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await pullProfile();
    await pushProfile();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Code einlösen übernimmt Favoriten und Einstellungen und merkt sich das Profil", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      respond(200, { id: "p".repeat(22), token: "t".repeat(43), data: REMOTE, updatedAt: 5 }),
    );
    await claimTransfer("ABCD-EFGH");
    expect(getFavorites().map((f) => f.name)).toEqual(["Düsseldorf Hbf"]);
    expect(getSettings().favoriteCount).toBe(6);
    expect(getProfile()).toEqual({ id: "p".repeat(22), token: "t".repeat(43), syncedAt: 5 });
  });

  it("Übertragen legt das Profil mit den Daten dieses Geräts an, mit Schlüssel im Kopf", async () => {
    setFavorites([HBF]);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        respond(200, { id: "p".repeat(22), token: "t".repeat(43), updatedAt: 1 }),
      )
      .mockImplementationOnce(() => respond(200, { code: "ABCDEFGH", expiresAt: 99 }));
    expect(await startTransfer()).toEqual({ code: "ABCDEFGH", expiresAt: 99 });
    const [, create] = fetch.mock.calls[0] ?? [];
    expect(typeof create?.body).toBe("string");
    expect(JSON.parse(typeof create?.body === "string" ? create.body : "")).toEqual({
      data: localData(),
    });
    const [, transfer] = fetch.mock.calls[1] ?? [];
    expect(new Headers(transfer?.headers).get("Authorization")).toBe(
      `Bearer ${"p".repeat(22)}.${"t".repeat(43)}`,
    );
  });

  it("älterer Stand vom Server ändert nichts, neuerer wird übernommen", async () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ id: "p".repeat(22), token: "t".repeat(43), syncedAt: 10 }),
    );
    setFavorites([]);
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      respond(200, { data: REMOTE, updatedAt: 9 }),
    );
    await pullProfile();
    expect(getFavorites()).toEqual([]);
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      respond(200, { data: REMOTE, updatedAt: 11 }),
    );
    await pullProfile();
    expect(getFavorites()).toHaveLength(1);
    expect(getProfile()?.syncedAt).toBe(11);
  });

  it("vom Server gelöschtes Profil wird hier vergessen, die Daten bleiben", async () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ id: "p".repeat(22), token: "t".repeat(43), syncedAt: 1 }),
    );
    setFavorites([HBF]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      respond(404, { error: "profile_not_found" }),
    );
    await expect(pullProfile()).rejects.toThrow("profile_not_found");
    expect(getProfile()).toBeNull();
    expect(getFavorites()).toHaveLength(1);
  });
});
