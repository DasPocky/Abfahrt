import { describe, expect, it } from "vitest";
import { fitFavorites, LIST_GAP, MORE_HEIGHT, type CardSize } from "./dashboard";

const card = (chrome: number, ...rows: number[]): CardSize => ({ chrome, rows });
const height = (cards: CardSize[], rows: number[]) =>
  rows.reduce(
    (a, r, i) =>
      a + (cards[i]?.chrome ?? 0) + (cards[i]?.rows.slice(0, r).reduce((x, y) => x + y, 0) ?? 0),
    0,
  ) +
  (rows.length - 1) * LIST_GAP +
  (rows.length < cards.length ? MORE_HEIGHT : 0);

describe("fitFavorites: Dashboard passt ohne Scrollen", () => {
  it("ohne Favoriten nichts", () => {
    expect(fitFavorites(500, [], 4)).toEqual([]);
  });

  it("viel Platz: alle Zeilen bis zur Einstellung", () => {
    const cards = [card(60, 44, 44, 44, 44, 44), card(60, 44, 44)];
    expect(fitFavorites(2000, cards, 4)).toEqual([4, 2]);
  });

  it("übriger Platz geht reihum von oben, hohe Zeilen zählen mit ihrer echten Höhe", () => {
    // 3 Karten mit erster Zeile: 3·(60+44) + 2·12 = 336; Rest 64 reicht für eine 44er-Zeile, nicht für die 70er
    const cards = [card(60, 44, 70, 44), card(60, 44, 44), card(60, 44, 44)];
    expect(fitFavorites(400, cards, 4)).toEqual([1, 2, 1]);
  });

  it("zu wenig Platz für alle: die ersten, Rest hinter „weitere“", () => {
    const cards = Array.from({ length: 5 }, () => card(60, 44, 44));
    const rows = fitFavorites(300, cards, 4);
    expect(rows.length).toBe(2);
    expect(height(cards, rows)).toBeLessThanOrEqual(300);
  });

  it("nie weniger als ein Favorit mit einer Zeile, auch wenn es nicht passt", () => {
    expect(fitFavorites(50, [card(60, 44), card(60, 44)], 4)).toEqual([1]);
  });

  it("was gezeigt wird, passt immer, und keine Karte hat mehr als die Einstellung", () => {
    const cases = [];
    for (let available = 120; available <= 900; available += 7)
      for (let count = 1; count <= 6; count++)
        cases.push({
          available,
          cards: Array.from({ length: count }, (_, i) => card(55 + i * 7, 44, 62, 44, 50, 44)),
        });
    // Nur Fälle, in denen mindestens eine Karte mit einer Zeile Platz hat
    for (const { available, cards } of cases.filter((c) => c.available >= height(c.cards, [1]))) {
      const rows = fitFavorites(available, cards, 3);
      expect(Math.max(...rows)).toBeLessThanOrEqual(3);
      expect(height(cards, rows)).toBeLessThanOrEqual(available);
    }
  });
});
