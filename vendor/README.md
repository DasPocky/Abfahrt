# Angepasste Abhängigkeiten

## picomatch 4.0.7-abfahrt.1

**Warum:** [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (CVSS 8,7, nur
Verfügbarkeit): picomatch bis 4.0.7 hängt bei einzelnen wiederholten Extglobs mit nacktem `*` wie
`+(*)` oder `+(*a)` exponentiell (24 Zeichen ≈ 3 s). Stand 18.11.2026 gibt es keine reparierte
Version; Vite 8, Vitest 5 und tinyglobby hängen auch in ihren neuesten Versionen an picomatch 4.

**Wofür wir es brauchen:** nur indirekt in den Entwicklungswerkzeugen (Vite: Dateiüberwachung und
Build, Vitest: Testdateien finden, tinyglobby/fdir: Dateisuche). Unser Code nutzt picomatch nicht, in
App und Worker ist es nicht enthalten, und alle Muster stammen aus unseren eigenen Konfigurationen.

**Was geändert ist:** Kopie von picomatch 4.0.7 (MIT, `LICENSE`), nur `lib/parse.js`
(`analyzeRepeatedExtglob`, `extglobClose`, markiert mit „Abfahrt-Fix“). Ein einzelner Zweig X mit
nacktem `*` ohne `/` und Klammern wird ohne äußere Wiederholung übersetzt: `+(X)` = `X`,
`*(X)` = leer oder `X` (gleiche Bedeutung, kein verschachtelter Quantor). Zweige mit `/` oder `(`
werden wie andere riskante Muster wörtlich genommen.

**Geprüft (18.11.2026):** offizielle Testsuite von picomatch 4.0.7 (1.983 Tests) grün; Vergleich
Original gegen Fix mit 54 Mustern × allen Eingaben bis 4 Zeichen aus 10 Zeichen (≈ 3,1 Mio.
Vergleiche, mit und ohne `dot`): keine Unterschiede; böswillige Eingaben bis 5.000 Zeichen höchstens
8 ms. Regressionstest: `vendor/picomatch-fix.test.ts`.

**Eingebunden** über `package.json`: `devDependencies.picomatch = file:vendor/picomatch` und
`overrides.picomatch = $picomatch`, damit Vite, Vitest, tinyglobby und fdir diese Kopie nutzen.

**Entfernen,** sobald picomatch eine reparierte Version veröffentlicht: Override, Abhängigkeit und
diesen Ordner löschen, `npm install`, `npm audit` prüfen (Issue im Repo).
