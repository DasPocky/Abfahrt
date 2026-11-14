// Zeit- und Verspätungsformatierung für die Abfahrtsanzeige. Anzeige immer in Europe/Berlin.

export const DISPLAY_TIME_ZONE = "Europe/Berlin";

const clockFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

const clockWithSecondsFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

const MINUTE_MS = 60_000;

/** Uhrzeit als „HH:MM“ in Europe/Berlin */
export function formatClock(date: Date): string {
  return clockFormat.format(date);
}

/** Uhrzeit als „HH:MM:SS“ in Europe/Berlin */
export function formatClockWithSeconds(date: Date): string {
  return clockWithSecondsFormat.format(date);
}

/** Ganze Minuten bis zur Abfahrt (abgerundet), negativ wenn vorbei */
export function minutesUntil(target: Date, now: Date): number {
  return Math.floor((target.getTime() - now.getTime()) / MINUTE_MS);
}

/**
 * Countdown-Text: „jetzt“ unter einer Minute (auch knapp vorbei),
 * „in N Min“ bis 59 Minuten, danach die Uhrzeit.
 */
export function formatCountdown(target: Date, now: Date): string {
  const minutes = minutesUntil(target, now);
  if (minutes < 1) return "jetzt";
  if (minutes < 60) return `in ${minutes} Min`;
  return formatClock(target);
}

/** Verspätung in ganzen Minuten (gerundet), null ohne Echtzeit */
export function delayMinutes(plannedTime: string, realtimeTime: string | null): number | null {
  if (realtimeTime === null) return null;
  const diff = Date.parse(realtimeTime) - Date.parse(plannedTime);
  if (Number.isNaN(diff)) return null;
  return Math.round(diff / MINUTE_MS);
}

export type DelayTone = "unknown" | "success" | "warning" | "destructive";

/** Farbton der Verspätung: pünktlich/zu früh grün, 1–4 Min gelb, ab 5 Min rot */
export function delayTone(delay: number | null): DelayTone {
  if (delay === null) return "unknown";
  if (delay <= 0) return "success";
  if (delay < 5) return "warning";
  return "destructive";
}

/** Verspätungstext: „+2“, „-1“, „pünktlich“ statt „+0“; leer ohne Echtzeit */
export function formatDelay(delay: number | null): string {
  if (delay === null) return "";
  if (delay === 0) return "pünktlich";
  return delay < 0 ? `${delay}` : `+${delay}`;
}
