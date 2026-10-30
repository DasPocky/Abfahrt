# Roadmap

Jeder Punkt wird ein eigenes Issue. Ich schlage die Issues vor, du nickst sie ab. Erst dann geht es los.

## M0 – Fundament

- Repo-Regeln: Issue-/PR-Vorlagen, Labels, `CONTRIBUTING.md`, `SECURITY.md`, Lizenz
- CI: parallele Jobs (Lint, Typecheck, Tests, Build, Security-Scans, PR-Titel-Check), Dependabot
- Projekt-Gerüst: React + Vite + TS, Worker mit Static Assets, `wrangler.jsonc`
- Deploy-Pipeline: Preview pro PR, Produktion bei Merge auf `main`. Dabei testen: Cache API auf `workers.dev`.

## M1 – Abfahrtsmonitor + Favoriten (MVP)

- Worker: Adapter VRR + Transitous, internes Format, Cache, Rate-Limit, Security-Header
- Haltestellensuche mit Autovervollständigung
- Haltestellen in der Nähe (GPS) inklusive Entfernung
- Abfahrtsliste:
  - Countdown, Planzeit und Verspätung, Gleis/Steig, Linienfarben und Icons
  - Ausfälle und Hinweise
  - Refresh alle 30 s
- Filter nach Verkehrsmittel, Linie/Richtung, Gleis/Steig und „ab Uhrzeit“, pro Favorit speicherbar
- Favoriten-Startseite mit Live-Abfahrten
- Karte mit Haltestellen (MapLibre + OpenFreeMap)
- PWA: installierbar, Offline-Shell, Hell/Dunkel automatisch
- Über-Seite mit Pflicht-Quellhinweisen

## M2 – Verbindungssuche

- Von/Nach mit Haltestellen, Adressen, POIs und aktuellem Standort
- Ab-/An-Zeit, Datum, Verkehrsmittel ausschließen (z. B. ohne Fernverkehr), maximale Umstiege, Umstiegszeit, Barrierefreiheit
- Echtzeit pro Abschnitt, Warnung bei gefährdetem Anschluss
- Zwischenhalte, Routenkarte
- Live-Begleitung einer gemerkten Verbindung

## M3 – Störungen & Push

- Störungen bei Haltestelle/Linie, eigene Übersichtsseite, Banner für Favoriten
- Aufzugsstörungen (VRR MIP)
- Web Push: Cron-Trigger + D1, VAPID-Signatur im Worker. Unter iOS nur, wenn die App installiert ist.

## M4 – Extras

- Live-Fahrzeugkarte (Transitous `map/trips`)
- Wagenreihung/Auslastung (DB RIS::Transports, Registrierung nötig)
- Widget-/Tafel-Ansicht (z. B. Tablet an der Wand)
- Teilen per Link
- Ausbau NRW: VRS, AVV mit eigenen Keys
