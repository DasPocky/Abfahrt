# Barrierefreiheit

Ziel: WCAG 2.2 Stufe AA (Grundlage von BITV 2.0 und EN 301 549), freiwillig (#128). Die Erklärung für
Nutzer steht in der App unter **Mehr → Barrierefreiheit** (`src/pages/accessibility-page.tsx`).

## Automatisch bei jeder Änderung

`src/a11y.test.tsx` rendert alle Hauptseiten mit Testdaten (Startseite, Haltestelle mit Ausfall und
Hinweis, Verbindung, Störungen, Mehr, Einstellungen, Über, Erklärung) und prüft sie mit **axe-core**
(Regeln `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`). Kontrast und
Zielgröße brauchen echtes Layout und fehlen dort; die prüft das Browser-Audit. Dazu: eigener Titel je
Seite und Fokus auf die Überschrift nach einem Seitenwechsel.

## Browser-Audit 18.11.2026

Chromium, iPhone 13 (390 px) und 320 px Breite, hell und dunkel, Live-Daten (Düsseldorf Hbf,
Heinrich-Heine-Allee → Essen Hbf), axe-core 4.10 im Browser, Tastatur-Durchlauf.

| Befund                                                                          | Kriterium     | Behoben                                                               |
| ------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| Grauer Text auf grauem Grund 4,34 : 1 (z. B. Umschalter in den Einstellungen)   | 1.4.3         | `--muted-foreground` hell 0.556 → 0.52 (≥ 4,5 : 1 auf `--muted`)      |
| Weiß auf Blau-500 im Dunkelmodus 3,7 : 1 (aktive Umschalter, Abschnittsnummern) | 1.4.3         | auch dunkel Blau-600                                                  |
| Zwei Bereiche „Karte“ (Seite und MapLibre-Fläche)                               | best practice | Überschrift „Karte mit Haltestellen und Fahrzeugen“, Fläche benannt   |
| Fokus in der Navigation unten, unter „Mehr“ und in Von/Nach kaum sichtbar       | 2.4.7         | Fokusring; Ringfarbe hell 0.45, dunkel 0.78 (≥ 3 : 1)                 |
| Fokus kann unter der festen Navigation unten verschwinden                       | 2.4.11        | `scroll-padding-bottom` in Höhe der Navigation                        |
| Kein eigener Seitentitel je Ansicht                                             | 2.4.2         | `usePageTitle` in allen Seiten („Abfahrten Düsseldorf Hbf · Abfahrt“) |
| Nach Seitenwechsel bleibt der Fokus am alten Link                               | best practice | Fokus auf die neue `h1` (`src/components/layout.tsx`)                 |
| Ziele bei 320 px abgeschnitten („Neuss …“)                                      | 1.4.10        | Ziel bis zu zwei Zeilen, Zeit-Zeile bricht um                         |
| Animationen auch bei „Bewegung reduzieren“                                      | 2.3.3 (AAA)   | globale Regel `prefers-reduced-motion`, Karte ohne Kamerafahrt        |

Danach: axe im Browser ohne Befund auf allen Seiten (hell und dunkel), kein seitliches Scrollen bei
320 px, jedes per Tastatur erreichbare Element mit sichtbarem Fokus und nicht verdeckt.

## Noch offen

- Test mit echten Screenreadern: VoiceOver (iOS), TalkBack (Android), NVDA (Windows).
- Karte: Kartenbild nur eingeschränkt mit Screenreader/Tastatur; Alternativen sind Suche, „In der Nähe“
  und Listen.
- Bedienflächen: WCAG 2.2 AA verlangt 24 × 24 px (erfüllt, axe `target-size`); 44 × 44 px (AAA) noch
  nicht überall, z. B. kleine Schaltflächen in den Verbindungsdetails.

## Prüfen

```sh
npm run test:app -- src/a11y.test.tsx
```

Für das Browser-Audit `axe.min.js` aus `node_modules/axe-core` in die Seite laden und
`axe.run(document, { runOnly: { type: "tag", values: ["wcag22aa", …] } })` ausführen, je Seite hell
und dunkel.
