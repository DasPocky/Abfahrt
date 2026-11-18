# Angepasste Abhängigkeiten

## picomatch 4.0.7-abfahrt.2

**Status:** eigener Fix, bis picomatch einen offiziellen Patch veröffentlicht. Der Workflow
`.github/workflows/picomatch-watch.yml` prüft jeden Montag die Meldung und npm. Gibt es einen Patch
oder eine neue Version, schlägt er fehl (GitHub benachrichtigt). **Dann ersetzen wir den eigenen Fix
wieder durch das offizielle Paket** (Abschnitt „Entfernen“, Issue #137).

### Warum

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) / CVE-2026-112366, CVSS 8,7
(nur Verfügbarkeit), veröffentlicht 19.10.2026: picomatch bis 4.0.7 hängt bei einzelnen wiederholten
Extglobs mit nacktem `*` wie `+(*)` oder `+(*a)` exponentiell; Ursache `analyzeRepeatedExtglob` in
`lib/parse.js`. Laut Meldung „Patched versions: None“ (Stand 18.11.2026); im picomatch-Repository
liegen über 15 offene Fix-Vorschläge (z. B. #238, #254, #273), eine Antwort des Maintainers fehlt.
Vite 8, Vitest 5 und tinyglobby hängen auch in ihren neuesten Versionen an picomatch 4.

Ausnutzbar nur, wenn ein Angreifer das **Glob-Muster** bestimmt.

### Wofür wir es brauchen

Nur indirekt in den Entwicklungswerkzeugen: Vite (Dateiüberwachung, Build), Vitest (Testdateien
finden), tinyglobby/fdir (Dateisuche). Unser Code nutzt picomatch nicht, in App und Worker ist es
nicht enthalten, und alle Muster stammen aus unseren eigenen Konfigurationsdateien.

### Was geändert ist

Kopie von picomatch 4.0.7 (MIT, `LICENSE`), nur `lib/parse.js`, Stellen markiert mit „Abfahrt-Fix“.
Beide Änderungen erhalten die Bedeutung der Muster:

1. **Meldung (einzelner Zweig):** Ein Zweig X mit nacktem `*` ohne `/` und Klammern wird ohne äußere
   Wiederholung übersetzt: `+(X)` = `X`, `*(X)` = leer oder `X` (jede Folge von Treffern passt
   wieder auf X, das erste `*` schluckt den Mittelteil). Zweige mit `/` oder `(` werden wörtlich
   genommen wie andere riskante Muster in picomatch.
2. **picomatch-Issue #175 (zusammensetzbare Zweige, nicht Teil der Meldung):** Lässt sich ein reiner
   Text-Zweig aus anderen zusammensetzen (`ab|abab`, `abc|abcabc`), ist er in der Wiederholung
   überflüssig und fällt weg: `+(ab|abab)` = `+(ab)`. Reine Präfixe (`js|jsx`, `fo|foo`) sind
   harmlos und bleiben.

### Geprüft (18.11.2026)

- Offizielle Testsuite von picomatch 4.0.7: **1.983/1.983 grün.**
- Vergleich Original gegen Fix: **150 Mio. Fälle, 0 Unterschiede** (675 Muster mit allen fünf
  Extglob-Arten `+ * @ ? !`, einzelne und mehrere Zweige, mit Präfix/Suffix/Pfad; alle Eingaben bis
  5 Zeichen aus 10 Zeichen; mit und ohne `dot`).
- Laufzeit, jeweils im eigenen Prozess mit 3 s Grenze:

| Muster                                                      | Herkunft         | Original               | Fix (bis 2.000 Zeichen) |
| ----------------------------------------------------------- | ---------------- | ---------------------- | ----------------------- |
| `+(*)`, `+(*a)`                                             | Meldung          | > 3 s ab ~30 Zeichen   | ≤ 5 ms                  |
| `*(*a)`, `+(a*b)`, `+(*?a)`, `*(*?)`, `+(*a*)c`, `+(*a).js` | verwandt, eigene | > 3 s ab 20–40 Zeichen | ≤ 7 ms                  |
| `+(ab\|abab)`, `*(ab\|abab)`, `+(abc\|abcabc)`              | #175             | > 3 s ab ~80 Zeichen   | ≤ 5 ms                  |
| `!(*a)`, `@(*a)`, `?(*a)`, `+(?*a)`                         | Gegenprobe       | schnell                | schnell                 |

- Regressionstest im Projekt: `vendor/picomatch-fix.test.ts`.

### Restrisiko

Mehrzweigige Muster mit nacktem `*` (z. B. `+(*a|b)`, `*(a*|b)`) sind wie im Original weiter langsam.
Sie gehören nicht zur Meldung, und eine gleichwertige Umformung gibt es nicht ohne Weiteres
(wörtlich nehmen würde z. B. `*(a*|b)` ändern, das prüft die offizielle Testsuite). Bei uns nicht
erreichbar: keine fremden Muster, nur Entwicklungswerkzeuge.

### Eingebunden

`package.json`: `devDependencies.picomatch = file:vendor/picomatch` und
`overrides.picomatch = $picomatch` (npm verlangt die Abhängigkeit für `file:`-Overrides).
`npm ls picomatch` zeigt, dass Vite, Vitest, tinyglobby und fdir diese Kopie nutzen; Linter und
Prettier lassen `vendor/` aus.

### Entfernen

Sobald der Workflow einen offiziellen Patch meldet: Override und Abhängigkeit aus `package.json`
löschen, `vendor/picomatch` und `vendor/picomatch-fix.test.ts` löschen, in `vitest.config.ts`
`vendor/*.test.ts` und in `.prettierignore`/`.oxlintrc.json` die `vendor`-Einträge entfernen,
`npm install`, `npm audit` und alle Tests laufen lassen, `.github/workflows/picomatch-watch.yml`
löschen, #137 schließen.
