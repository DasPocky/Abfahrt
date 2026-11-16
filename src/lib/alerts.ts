// Störungsmeldungen (Sperrungen, Aufzüge, Infos): Sortierung, Filter, Bezug zu Favoriten,
// Kürzen und Gültigkeit. Reine Logik, Anzeige in Europe/Berlin.
import type { Alert, AlertKind, AlertSeverity, TransportMode } from "../../shared/api-types";
import type { Favorite } from "@/lib/favorites";
import { MODE_ORDER } from "@/lib/filters";
import { DISPLAY_TIME_ZONE } from "@/lib/time";

const KIND_RANK: Record<AlertKind, number> = { blocking: 0, facility: 1, info: 2 };
const SEVERITY_RANK: Record<AlertSeverity, number> = { high: 0, normal: 1, low: 2 };

/** Bezeichnung der Art für Screenreader und Panels */
export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  blocking: "Sperrung",
  facility: "Aufzug/Rolltreppe",
  info: "Info",
};

/** Meldungen ändern sich selten: 5 Minuten frisch */
export const ALERTS_STALE_MS = 5 * 60_000;

/** Query-Schlüssel einer Haltestellen-Abfrage (Haltestellenseite, Startseite, Übersicht) */
export function stopAlertsKey(stopId: string, lines: readonly string[] = []) {
  return ["alerts", "stop", stopId, lines.join(",")] as const;
}

type FavoriteRef = Pick<Favorite, "stopId" | "filter">;

function timeOf(iso: string | null): number | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Sperrungen vor Aufzügen vor Infos, dann nach Schwere, dann nach Gültigkeitsbeginn
 * (neuere zuerst, ohne Beginn zuletzt). Liefert eine neue Liste.
 */
export function sortAlerts(alerts: readonly Alert[]): Alert[] {
  return alerts.toSorted((a, b) => {
    const kind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kind !== 0) return kind;
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severity !== 0) return severity;
    const ta = timeOf(a.validFrom);
    const tb = timeOf(b.validFrom);
    if (ta === tb) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
}

/** Linienbezeichnung zum Vergleichen: ohne Leerzeichen, Großschreibung egal („RE 1“ = „RE1“) */
export function normalizeLine(line: string): string {
  return line.replaceAll(/\s+/g, "").toUpperCase();
}

/** Verkehrsmittel, die in den Meldungen vorkommen, in fester Reihenfolge */
export function alertModes(alerts: readonly Alert[]): TransportMode[] {
  const present = new Set(alerts.flatMap((a) => a.lines.map((l) => l.mode)));
  return MODE_ORDER.filter((m) => present.has(m));
}

/** Meldungen, die eines der Verkehrsmittel betreffen; ohne Auswahl alle */
export function filterAlertsByModes(
  alerts: readonly Alert[],
  modes: readonly TransportMode[],
): Alert[] {
  if (modes.length === 0) return [...alerts];
  return alerts.filter((a) => a.lines.some((l) => modes.includes(l.mode)));
}

/** Meldungen, die eine der Linien betreffen; ohne Auswahl alle */
export function filterAlertsByLines(alerts: readonly Alert[], lines: readonly string[]): Alert[] {
  if (lines.length === 0) return [...alerts];
  const wanted = new Set(lines.map(normalizeLine));
  return alerts.filter((a) => a.lines.some((l) => wanted.has(normalizeLine(l.line))));
}

/** Gleiche Haltestelle, auch wenn eine Seite einen Steig meint („…:18235:1:2“) */
export function sameStop(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}:`) || b.startsWith(`${a}:`);
}

export function affectsStop(alert: Alert, stopId: string): boolean {
  return alert.stops.some((s) => sameStop(s.id, stopId));
}

/** Betrifft die Meldung den Favoriten: seine Haltestelle oder eine Linie seines Filters */
export function affectsFavorite(alert: Alert, favorite: FavoriteRef): boolean {
  if (affectsStop(alert, favorite.stopId)) return true;
  if (favorite.filter.lines.length === 0) return false;
  const wanted = new Set(favorite.filter.lines.map(normalizeLine));
  return alert.lines.some((l) => wanted.has(normalizeLine(l.line)));
}

export function affectsAnyFavorite(alert: Alert, favorites: readonly FavoriteRef[]): boolean {
  return favorites.some((f) => affectsFavorite(alert, f));
}

/** Meldungen, die Favoriten betreffen, je ID einmal, sortiert */
export function favoriteAlerts(
  alerts: readonly Alert[],
  favorites: readonly FavoriteRef[],
): Alert[] {
  const byId = new Map<string, Alert>();
  for (const alert of alerts) {
    if (!byId.has(alert.id) && affectsAnyFavorite(alert, favorites)) byId.set(alert.id, alert);
  }
  return sortAlerts([...byId.values()]);
}

/**
 * Favoriten-Haltestellen für die Abfrage: nur VRR (andere haben keine Meldungen), je Haltestelle
 * einmal mit den Linien aus den Filtern ihrer Favoriten, höchstens `max`.
 */
export function favoriteAlertStops(
  favorites: readonly FavoriteRef[],
  max: number,
): { stopId: string; lines: string[] }[] {
  const byStop = new Map<string, Set<string>>();
  for (const f of favorites) {
    if (!f.stopId.startsWith("vrr:")) continue;
    let lines = byStop.get(f.stopId);
    if (!lines) {
      if (byStop.size >= max) continue;
      lines = new Set();
      byStop.set(f.stopId, lines);
    }
    for (const line of f.filter.lines) lines.add(line);
  }
  return [...byStop.entries()].map(([stopId, lines]) => ({
    stopId,
    lines: [...lines].toSorted((a, b) => a.localeCompare(b, "de", { numeric: true })),
  }));
}

/** Kürzt an einer Wortgrenze und hängt „…“ an */
export function truncateText(text: string, max: number): string {
  const clean = text.trim().replaceAll(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.–-]+$/, "")}…`;
}

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});
const yearFormat = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

/** „21.11.“, in einem anderen Jahr als `now` „21.11.2027“ */
export function formatDay(date: Date, now: Date): string {
  const day = dayFormat.format(date);
  const year = yearFormat.format(date);
  return year === yearFormat.format(now) ? day : `${day}${year}`;
}

/** Enden so weit in der Zukunft gelten als offen (Platzhalter der Quelle) */
const OPEN_END_MS = 2 * 365 * 86_400_000;

/**
 * Kurze Gültigkeit: „ab 21.11.“ (noch nicht begonnen), „bis 21.11.“, „seit 10.10.“ (ohne Ende);
 * leer, wenn nichts bekannt ist.
 */
export function formatValidity(alert: Pick<Alert, "validFrom" | "validTo">, now: Date): string {
  const from = timeOf(alert.validFrom);
  let to = timeOf(alert.validTo);
  if (to !== null && to - now.getTime() > OPEN_END_MS) to = null;
  if (from !== null && from > now.getTime()) return `ab ${formatDay(new Date(from), now)}`;
  if (to !== null) return `bis ${formatDay(new Date(to), now)}`;
  if (from !== null) return `seit ${formatDay(new Date(from), now)}`;
  return "";
}

/** Vergleichsschlüssel für Texte: Leerraum zusammengefasst, ohne Satzzeichen am Ende */
function textKey(text: string): string {
  return text
    .trim()
    .replaceAll(/\s+/g, " ")
    .replace(/[\s.:;,!]+$/, "")
    .toLowerCase();
}

/**
 * Steht die Meldung schon in den Hinweisen der Abfahrten? Gleicher Titel oder Text, oder ein
 * Hinweis enthält den Titel (die Quelle setzt Titel und Text dort oft zusammen).
 */
export function duplicatesNotice(alert: Alert, notices: readonly string[]): boolean {
  const title = textKey(alert.title);
  const text = textKey(alert.text);
  return notices.some((notice) => {
    const key = textKey(notice);
    if (!key) return false;
    if (key === title || (text !== "" && key === text)) return true;
    return title.length >= 15 && key.includes(title);
  });
}

/**
 * Titel ohne vorangestellten Haltestellennamen, für die Anzeige an der Haltestelle selbst:
 * „Haltestelle D-Heinrich-Heine-Allee U: Rolltreppe außer Betrieb.“ → „Rolltreppe außer Betrieb“
 */
export function titleAtStop(alert: Pick<Alert, "title">): string {
  const match = /^Haltestelle [^:]+:\s*(.+)$/.exec(alert.title);
  return (match?.[1] ?? alert.title).replace(/\.$/, "");
}

/** Aufzüge/Rolltreppen getrennt von übrigen Meldungen (eigene Zeile an der Haltestelle) */
export function splitFacilityAlerts(alerts: readonly Alert[]): {
  facility: Alert[];
  other: Alert[];
} {
  return {
    facility: alerts.filter((a) => a.kind === "facility"),
    other: alerts.filter((a) => a.kind !== "facility"),
  };
}

/** Abfahrten ohne die Hinweise, die `drop` erfasst (z. B. weil sie schon als Meldung dastehen) */
export function withoutNotices<T extends { notices: string[] }>(
  departures: readonly T[],
  drop: (notice: string) => boolean,
): T[] {
  return departures.map((d) => {
    const notices = d.notices.filter((n) => !drop(n));
    return notices.length === d.notices.length ? d : { ...d, notices };
  });
}
