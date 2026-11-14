// Hinweise einer Abfahrtsliste aufteilen: Sammelhinweise für die Haltestelle und Hinweise je Fahrt.
import type { Departure } from "../../shared/api-types";

/** Ab so vielen Abfahrten mit demselben Hinweis gilt er als Hinweis für die Haltestelle */
export const STOP_NOTICE_MIN_DEPARTURES = 2;

export interface NoticeSummary {
  /** Hinweise, die mindestens zwei Abfahrten betreffen, je einmal, nach Häufigkeit sortiert */
  stopNotices: string[];
  /** Übrige Hinweise je Abfahrt (Schlüssel: Departure.id), ohne Sammelhinweise */
  departureNotices: Map<string, string[]>;
}

/** Vergleichsschlüssel: Leerraum zusammengefasst, Groß-/Kleinschreibung egal */
function noticeKey(notice: string): string {
  return notice.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

/**
 * Teilt die Hinweise auf: Gleicher Text bei mindestens zwei Abfahrten wird zum Sammelhinweis für
 * die Haltestelle und erscheint in den Zeilen nicht noch einmal.
 */
export function summarizeNotices(departures: readonly Departure[]): NoticeSummary {
  const counts = new Map<string, { text: string; count: number; first: number }>();
  departures.forEach((d, index) => {
    for (const key of new Set(d.notices.map(noticeKey).filter(Boolean))) {
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else {
        const text = d.notices.find((n) => noticeKey(n) === key)?.trim() ?? key;
        counts.set(key, { text, count: 1, first: index });
      }
    }
  });

  const shared = [...counts.entries()].filter(([, e]) => e.count >= STOP_NOTICE_MIN_DEPARTURES);
  const sharedKeys = new Set(shared.map(([key]) => key));
  // Häufigste zuerst, bei Gleichstand in der Reihenfolge des ersten Auftretens
  // Sortiert eine frische Kopie; toSorted() fehlt in älteren Safari-Versionen (iOS < 16)
  const stopNotices = shared
    .map(([, e]) => e)
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map((e) => e.text);

  const departureNotices = new Map<string, string[]>();
  for (const d of departures) {
    const seen = new Set<string>();
    const own: string[] = [];
    for (const notice of d.notices) {
      const key = noticeKey(notice);
      if (!key || sharedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      own.push(notice.trim());
    }
    departureNotices.set(d.id, own);
  }
  return { stopNotices, departureNotices };
}
