// Reine Logik für Abfahrtslisten: tatsächliche Abfahrtszeit, Sortierung, Filter.
import type { Departure } from "../../shared/api-types";

/** Tatsächliche Abfahrtszeit: Echtzeit, sonst Plan */
export function effectiveTime(departure: Departure): Date {
  return new Date(departure.realtimeTime ?? departure.plannedTime);
}

/** Sortiert nach tatsächlicher Abfahrtszeit, bei Gleichstand nach Plan und Linie. Ändert das Original nicht. */
export function sortDepartures(departures: readonly Departure[]): Departure[] {
  // Sortiert eine Kopie; toSorted() fehlt in älteren Safari-Versionen (iOS < 16)
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...departures].sort(
    (a, b) =>
      effectiveTime(a).getTime() - effectiveTime(b).getTime() ||
      Date.parse(a.plannedTime) - Date.parse(b.plannedTime) ||
      a.line.localeCompare(b.line, "de", { numeric: true }),
  );
}

/** Wie lange eine abgefahrene Fahrt noch angezeigt wird */
export const DEPARTED_GRACE_MS = 60_000;

/** Entfernt Fahrten, die länger als die Kulanzzeit vorbei sind */
export function upcomingDepartures(departures: readonly Departure[], now: Date): Departure[] {
  const cutoff = now.getTime() - DEPARTED_GRACE_MS;
  return departures.filter((d) => effectiveTime(d).getTime() >= cutoff);
}

/** Gleiswechsel: Plan- und Echtzeitgleis sind bekannt und verschieden */
export function hasPlatformChange(departure: Departure): boolean {
  return (
    departure.platform !== null &&
    departure.plannedPlatform !== null &&
    departure.platform !== departure.plannedPlatform
  );
}
