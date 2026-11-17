// Zeitpunkt der Verbindungssuche (#102): Tag, Uhrzeit und Schnellwahl als reine Funktionen.
// Gerechnet in der lokalen Zeit des Geräts, wie die Eingabefelder des Browsers.

const DAY_MS = 24 * 60 * 60_000;
/** Die API nimmt höchstens 7 Tage in der Zukunft an */
export const MAX_DAYS_AHEAD = 6;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Auf die volle Minute abgerundet */
function minuteOf(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000);
}

/** Tage zwischen dem Tag von `now` und dem von `time` (0 = heute) */
export function dayOffset(time: string | undefined, now: Date): number {
  if (time === undefined) return 0;
  const a = startOfDay(now);
  const b = startOfDay(new Date(time));
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Gleiche Uhrzeit an einem anderen Tag; ohne Zeitpunkt die aktuelle Uhrzeit */
export function withDay(time: string | undefined, offset: number, now: Date): string {
  const base = time ? new Date(time) : minuteOf(now);
  const day = startOfDay(now);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + offset,
    base.getHours(),
    base.getMinutes(),
  ).toISOString();
}

/** Uhrzeit „HH:MM“ am Tag des Zeitpunkts (ohne Zeitpunkt: heute) */
export function withClock(time: string | undefined, clock: string, now: Date): string | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!match) return time;
  const base = time ? new Date(time) : now;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Number(match[1]),
    Number(match[2]),
  ).toISOString();
}

/** Datum „JJJJ-MM-TT“ (Datumsfeld) mit der Uhrzeit des Zeitpunkts */
export function withDate(time: string | undefined, date: string, now: Date): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return time;
  const base = time ? new Date(time) : minuteOf(now);
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    base.getHours(),
    base.getMinutes(),
  ).toISOString();
}

/** Um `minutes` verschieben; ohne Zeitpunkt ab jetzt */
export function shiftMinutes(time: string | undefined, minutes: number, now: Date): string {
  const base = time ? new Date(time) : minuteOf(now);
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

/** „HH:MM“ für das Uhrzeitfeld */
export function clockValue(time: string | undefined, now: Date): string {
  const d = time ? new Date(time) : now;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** „JJJJ-MM-TT“ für das Datumsfeld */
export function dateValue(time: string | undefined, now: Date): string {
  const d = time ? new Date(time) : now;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

/** Tage zur Auswahl: Heute, Morgen, dann „Do 19.“ … bis MAX_DAYS_AHEAD */
export function dayChoices(now: Date, count = 5): { offset: number; label: string }[] {
  return Array.from({ length: Math.min(count, MAX_DAYS_AHEAD + 1) }, (_, offset) => {
    if (offset === 0) return { offset, label: "Heute" };
    if (offset === 1) return { offset, label: "Morgen" };
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { offset, label: `${WEEKDAY.format(day).replace(".", "")} ${day.getDate()}.` };
  });
}

/** Schnellwahl relativ zu jetzt */
export const QUICK_MINUTES = [15, 30, 60] as const;

export function quickLabel(minutes: number): string {
  return minutes < 60 ? `in ${minutes} Min` : `in ${minutes / 60} Std`;
}
