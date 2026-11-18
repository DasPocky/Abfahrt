# Roadmap

Jeder Punkt wird ein eigenes Issue. Ich schlage die Issues vor, du nickst sie ab. Erst dann geht es los.

## M0 – Fundament

✅ Erledigt. Live seit 13.11.2026, heute unter https://endlab.de/abfahrt

- Repo-Regeln: Issue-/PR-Vorlagen, Labels, `CONTRIBUTING.md`, `SECURITY.md`, Lizenz AGPL-3.0
- Mailtext VRR-Produktivzugang
- GitHub-Einstellungen: Ruleset für `main`, CodeQL, Secret-Scanning mit Push-Schutz, private Vulnerability Reports
- CI: parallele Jobs (Lint, Typecheck, Tests, Build, Security-Scans, PR-Titel-Check), Dependabot
- Projekt-Gerüst: React + Vite + TS, Worker mit Static Assets, `wrangler.jsonc`
- Deploy-Pipeline: Preview pro PR, Produktion bei Merge auf `main`. Cache API auf `workers.dev` getestet: funktioniert.

## M1 – Abfahrtsmonitor + Favoriten (MVP)

✅ Erledigt.

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

✅ Erledigt.

- Von/Nach mit Haltestellen, Adressen, POIs und aktuellem Standort
- Ab-/An-Zeit, Datum, Verkehrsmittel ausschließen (z. B. ohne Fernverkehr), maximale Umstiege, Umstiegszeit, Barrierefreiheit
- Echtzeit pro Abschnitt, Warnung bei gefährdetem Anschluss
- Zwischenhalte, Routenkarte
- Live-Begleitung einer gemerkten Verbindung (ohne Push, der kommt mit M3)

## M3 – Störungen & Push

✅ Erledigt.

- Störungen bei Haltestelle/Linie, eigene Übersichtsseite, Banner für Favoriten
- Aufzugsstörungen (VRR MIP)
- Web Push: Cron-Trigger + D1, VAPID-Signatur im Worker. Unter iOS nur, wenn die App installiert ist.

## M4 – Extras

- ✅ Live-Fahrzeugkarte (#92, Transitous `map/trips`, Position aus Fahrplan/Echtzeit geschätzt, siehe [Architektur](02-architektur.md))
- ✅ Steige auf der Karte, Zoomstufen, Abgleich der Verkehrsmittel mit dem VRR (#84, #86, #88)
- ✅ Orte bei Halten und Zielen in anderen Städten (#94)
- ✅ Umstieg am selben Steig bevorzugen, alle VRR-Optionen, einfachere Zeitauswahl (#97, #101, #102)
- ✅ Deutschlandweite Prüfung der Echtzeit (#104, [Echtzeit-Abdeckung](05-echtzeit-abdeckung.md))
- ✅ App-Struktur mit Navigation unten, Hauptbereiche gleichwertig (#106)
- ✅ Kartendaten in festen Kacheln laden und länger cachen (#98)
- ✅ Darstellungsvarianten der Abfahrtszeile in den Einstellungen (#37)
- Regionale Echtzeit-Quellen (#104): ✅ Baden-Württemberg (efa-bw). Offen bis zur Klärung der Nutzung: MVV,
  Bayern-Fahrplan, Westfalen, danach DB Timetables, RMV, VBN, HVV (Registrierung bzw. Anfrage), siehe
  [Echtzeit-Abdeckung](05-echtzeit-abdeckung.md)

## M5 – Features

Quellen reichen erst einmal, jetzt zählen die Funktionen.

**Prio 1**

- Suche: zuletzt genutzte Orte, Haltestellen zuerst, klare Symbole (#119)
- Fahrtverlauf einer Abfahrt mit allen Halten, Echtzeit und Karte (#120)
- Linienseite mit Linienverlauf (#121)
- Ankünfte an einer Haltestelle (#122)
- Abfahrtswecker per Push (#123)
- Übersichtlichkeit: weniger Lärm, Wichtiges zuerst (#124)
- Teilen per Link (#116)
- Tafel-Ansicht (z. B. Tablet an der Wand) (#117)

**Prio 2**

- Ausstiegsalarm in der Live-Begleitung
- Pendlerstrecken auf der Startseite (feste Von/Nach mit nächsten Verbindungen)
- „Jetzt losgehen“: Fußweg vom Standort zur Haltestelle eingerechnet
- In der Nähe: alle Linien rund um den Standort mit der nächsten Abfahrt
- Kalender-Export (.ics) einer Verbindung
- Defekte Aufzüge an Umstiegen direkt in der Verbindung

**Später**

- E-Scooter und Leihräder (GBFS der Anbieter, Bikesharing aus dem VRR MIP): Fahrzeuge auf der Karte, danach
  in der Verbindung
- Wagenreihung/Auslastung (DB API Marketplace, Registrierung nötig)
