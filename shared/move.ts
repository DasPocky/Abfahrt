/**
 * Umzug von endlab.de/abfahrt nach abfahrt.endlab.de.
 *
 * Browser trennen den Speicher je Adresse. Die alte Adresse liefert deshalb eine kleine Seite
 * aus (worker/move.ts), die alle Einträge mit dem Präfix „abfahrt:“ einpackt und im Anker
 * (#umzug=…) mitschickt. Der Anker geht nie an einen Server. Die neue Adresse packt ihn vor
 * allem anderen aus (src/move-in.ts) und entfernt ihn sofort.
 */
export const MOVE_PREFIX = "abfahrt:";
export const MOVE_PARAM = "umzug";
/** Nicht mitnehmen: Push-Abos gelten je Adresse und werden neu angemeldet */
export const MOVE_SKIP: readonly string[] = ["abfahrt:push-sent"];
/** Einträge darüber bleiben zurück */
export const MOVE_MAX_VALUE = 50_000;

/** base64url aus UTF-8 */
export function encodeMove(data: Record<string, string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gegenstück zu encodeMove; alles, was nicht passt, ergibt null */
export function decodeMove(text: string): Record<string, string> | null {
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith(MOVE_PREFIX) || MOVE_SKIP.includes(k)) continue;
      if (typeof v === "string" && v.length <= MOVE_MAX_VALUE) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Was aus dem Umzug übernommen wird: nur Einträge, die hier noch fehlen */
export function movePlan(
  data: Record<string, string>,
  has: (key: string) => boolean,
): [string, string][] {
  return Object.entries(data).filter(([k]) => !has(k));
}
