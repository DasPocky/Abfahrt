/** Gemessene Favoritenkarte: Höhe ohne Abfahrten (Kopf, Ränder, Ladehinweis) und jede Abfahrtszeile */
export interface CardSize {
  chrome: number;
  rows: number[];
}

/** Abstand zwischen zwei Karten und Höhe der Zeile „+ n weitere“ */
export const LIST_GAP = 12;
export const MORE_HEIGHT = 48; // Knopf 32 + Abstand davor 12 + Luft

/**
 * Wie viele Favoriten mit wie vielen Abfahrten passen in die Höhe `available`, ohne zu scrollen?
 * Rechnet mit den echten Höhen jeder Karte und jeder Zeile. Zuerst alle Favoriten mit ihrer ersten
 * Abfahrt; reicht der Platz nicht, die ersten so vielen, wie passen, plus die Zeile „+ n weitere“
 * (mindestens ein Favorit). Übriger Platz geht reihum von oben zeilenweise an die Karten, je Karte
 * höchstens `maxRows` (Einstellung). Ergebnis: Zeilen je gezeigter Karte, von oben nach unten.
 */
export function fitFavorites(
  available: number,
  cards: readonly CardSize[],
  maxRows: number,
  gap = LIST_GAP,
  more = MORE_HEIGHT,
): number[] {
  const count = cards.length;
  if (count === 0) return [];
  const cap = Math.max(1, maxRows);
  const first = (c: CardSize) => c.chrome + (c.rows[0] ?? 0);
  for (let shown = count; shown >= 1; shown--) {
    const visible = cards.slice(0, shown);
    let used =
      visible.reduce((a, c) => a + first(c), 0) + (shown - 1) * gap + (shown < count ? more : 0);
    if (used > available && shown > 1) continue;
    const rows = visible.map(() => 1);
    // reihum von oben: jede Karte eine Zeile mehr, solange sie passt und vorhanden ist
    for (let round = 1; round < cap; round++) {
      let added = false;
      visible.forEach((c, i) => {
        const next = c.rows[round];
        if (next === undefined || (rows[i] ?? 0) !== round || used + next > available) return;
        rows[i] = round + 1;
        used += next;
        added = true;
      });
      if (!added) break;
    }
    return rows;
  }
  return [1];
}
