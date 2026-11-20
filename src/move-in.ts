/**
 * Umzug annehmen (siehe shared/move.ts). main.tsx ruft das als Erstes auf, bevor die App den
 * Speicher liest.
 */
import { decodeMove, movePlan, MOVE_PARAM } from "../shared/move";

const stored = (key: string) => localStorage.getItem(key) !== null;

export function moveIn(): void {
  if (typeof window === "undefined") return;
  const hash = new URLSearchParams(location.hash.slice(1));
  const packed = hash.get(MOVE_PARAM);
  if (packed === null) return;
  // Anker sofort weg – er soll weder im Verlauf noch in geteilten Links stehen
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  const data = decodeMove(packed);
  if (!data) return;
  try {
    for (const [key, value] of movePlan(data, stored)) localStorage.setItem(key, value);
  } catch {
    // Speicher voll oder gesperrt: dann eben ohne alte Daten
  }
}
