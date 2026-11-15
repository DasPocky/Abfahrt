# Abfahrt

Echtzeit-ÖPNV-Auskunft als Progressive Web App – Fokus Düsseldorf/Rheinland, Ziel ganz Deutschland.

- Minutengenaue Live-Abfahrten
- Verbindungssuche mit Echtzeit
- Störungen & Meldungen
- Favoriten & Pendlerstrecken

Läuft komplett auf Cloudflare (Free-Plan). Konzept und Datenquellen: siehe [`docs/`](docs/).

## Bedienung

1. Auf der Startseite den Namen einer Haltestelle eingeben (ab 2 Zeichen erscheinen Vorschläge). Beim Öffnen fordert die App den **Standort** an (der Browser fragt um Erlaubnis): Mit Erlaubnis stehen Treffer in deiner Nähe oben (z. B. „Holthausen“ in Düsseldorf vor Essen), jeweils mit Entfernung. Das 📍-Symbol im Suchfeld schaltet das an und aus, ausgeschaltet fragt die App nicht mehr. Lehnt man im Browser ab, fragt sie beim nächsten Öffnen wieder; wird der Standort in den Einstellungen freigegeben, holt sie ihn sofort. Für die Suche wird der Standort nur im Gerät verwendet. Blockiert der Browser den Standort (am iPhone oft über die Ortungsdienste), zeigt die App „So gibst du ihn frei“ mit den Schritten für iPhone, Android und Computer.
   Unter **„In der Nähe“** zeigt die Startseite die Haltestellen im Umkreis von 1 km, die nächste zuerst. Dafür geht der Standort auf ~100 m gerundet an den Worker.
2. Treffer antippen – oder per Tastatur: Pfeil runter/hoch wählt, Enter öffnet, Esc leert die Suche.
3. Die Abfahrtsseite (`/abfahrt/haltestelle/<id>`) lädt alle 30 Sekunden neu, der Countdown läuft dazwischen weiter. Der Link lässt sich als Lesezeichen speichern.
4. **Filtern:** Über der Liste stehen die Verkehrsmittel, die an der Haltestelle fahren (z. B. S-Bahn, U-Bahn, Bus). Antippen filtert, mehrere sind möglich. Über das **Filter-Symbol** rechts gibt es Linien, Gleis/Steig und „Abfahrten ab“ (Uhrzeit). Der Filter steht in der Adresse, der Link lässt sich also teilen.
5. Mit dem **Stern** wird die aktuelle Ansicht zum Favoriten, inklusive Filter. Dieselbe Haltestelle kann mehrfach gespeichert werden (z. B. „Hbf · S-Bahn“ und „Hbf · U-Bahn“). Favoriten erscheinen auf der Startseite unter „Meine Haltestellen“ mit den nächsten Abfahrten. Über **Bearbeiten** lassen sie sich umbenennen, verschieben und entfernen. Sie werden nur im eigenen Browser gespeichert.
6. **Karte:** Unter der Suche führt „Haltestellen auf der Karte“ zu `/abfahrt/karte`. Ab Straßenzoom erscheinen die Haltestellen als Punkte (ab Zoomstufe 16 mit Namen), beim Herauszoomen bittet die Karte ums Heranzoomen. Punkt antippen zeigt den Namen und **Abfahrten**. Die Karte startet am Standort, wenn er in der App schon erlaubt ist (sonst Düsseldorf Innenstadt), das Fadenkreuz oben links springt dorthin. An unseren Server geht nur der sichtbare Ausschnitt, nicht der Standort.
7. **Verbindung suchen:** Unter der Suche führt „Verbindung suchen“ zu `/abfahrt/verbindung`. **Von** und **Nach** wie in der Suche eintippen: Haltestellen, aber auch Adressen (🏠, z. B. „Königsallee 1“) und Orte (🏛, z. B. „Rheinturm“), Treffer in deiner Nähe zuerst. Bei Adressen und Orten beginnt bzw. endet die Verbindung mit einem Fußweg. Oder „Mein Standort“ wählen, dann gilt die nächste Haltestelle. Von und Nach stehen gemeinsam in einem Kasten, der runde Pfeil-Knopf tauscht sie. Darunter öffnet der Chip **„Ab jetzt ▾“** Abfahrt/Ankunft und Datum/Uhrzeit (er zeigt dann z. B. „An morgen 08:15“, „Jetzt“ setzt zurück). Das **Optionen-Symbol** daneben öffnet Verkehrsmittel (z. B. ohne Fernzug), Umstiege (beliebig, direkt, max. 1/2), Umstiegszeit (kurz, normal, mehr Zeit) und „Stufenfrei“. Aktive Optionen stehen kurz unter der Zeile. Jede Verbindung zeigt oben Ab → An mit Verspätung, Dauer und Umstiege, darunter einen **Balken** mit den Fahrten in Linienfarbe (Länge nach Fahrzeit, Fußwege gepunktet) und „ab 14:53 Gleis 2“ der ersten Fahrt (mit Fußweg davor: „4 Min, dann ab …“). Ausfälle sind rot markiert. Knappe Umstiege (unter 2 Minuten Puffer nach Echtzeit und Fußweg) zeigt die Zeile als „Anschluss gefährdet“ (gelb) bzw. „Anschluss nicht erreichbar“ (rot). Antippen klappt die Details als **Zeitleiste** auf: Zeiten links, eine Linie in Linienfarbe von Halt zu Halt, je Fahrt Linie, Richtung, Ab/An mit Verspätung und Gleis/Steig (Gleiswechsel in Orange), „N Zwischenhalte“ zum Aufklappen, Fußwege mit Dauer und Länge, die Umstiegszeit vor jeder Anschlussfahrt sowie Hinweise (antippen für den vollen Text). Ausgefallene Fahrten und Halte sind rot bzw. durchgestrichen. Oben in den Details öffnet **Karte** die Routenkarte: jede Fahrt als Linie in Linienfarbe, Fußwege grau gestrichelt, Start und Ziel als gefüllte Punkte mit Namen, Umstiege als kleine Kreise, auf die ganze Strecke gezoomt. Verschieben mit zwei Fingern (am Rechner Strg + Mausrad zum Zoomen), damit die Seite mit einem Finger weiter scrollt; per Tastatur Tab auf die Karte, dann Pfeiltasten und +/−. Fehlt der Streckenverlauf, verbindet die Karte die Halte. **Früher**/**Später** blättern. Alle Angaben stehen in der Adresse (`?von=…&nach=…&zeit=…&ankunft=1&ohne=longdistance,bus&umstiege=1&umstiegszeit=mehr&barrierefrei=1`), der Link lässt sich teilen.
8. **Live-Begleitung:** In den Details einer Verbindung merkt **„Merken & live verfolgen“** sie und öffnet `/abfahrt/fahrt`. Dort steht groß der nächste Schritt („U76 ab Holthausen · Gleis 2 – Abfahrt in 5 Min“, unterwegs „Ankunft in 12 Min“, beim Umstieg „Umsteigen: S6 ab … in 6 Min“), darunter die Zeitleiste. Die Seite fragt alle 30 Sekunden neu ab und erkennt die Verbindung an Linien und Planzeiten wieder. Ist ein Anschluss gefährdet, fällt etwas aus oder ist die Verbindung nicht mehr im Fahrplan, erscheint eine Warnung mit **Alternativen suchen** (ab dem nächsten Einstieg). Die Startseite zeigt die Fahrt oben, bis 30 Minuten nach der Ankunft. **Begleitung beenden** löscht sie. Gespeichert wird nur im Browser (`abfahrt:trip`).

## Auf dem Homescreen installieren

Abfahrt ist eine Progressive Web App und lässt sich wie eine normale App starten:

- **iPhone/iPad (Safari):** https://endlab.de/abfahrt öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.
- **Android (Chrome):** https://endlab.de/abfahrt öffnen → Menü **⋮** → **App installieren** (bzw. **Zum Startbildschirm hinzufügen**).

Die App-Hülle startet danach auch ohne Netz. Abfahrten brauchen immer eine Verbindung, offline erscheint eine Fehlermeldung. Quellen, Datenschutz und Lizenz stehen unter [Über Abfahrt](https://endlab.de/abfahrt/ueber).

## Live

- App: https://endlab.de/abfahrt (Cloudflare-Worker-Route, wie die anderen EndLab-Apps)
- Jeder PR bekommt automatisch eine eigene Preview-URL (Kommentar im PR).

## Entwicklung

Voraussetzung: Node.js 26 LTS (siehe `.nvmrc`)

```bash
npm ci              # Abhängigkeiten installieren
npm run dev         # App + Worker lokal (http://localhost:5173/abfahrt/)
npm run lint        # Oxlint (typgestützt) + Prettier
npm run typecheck   # Worker-Typen erzeugen + TypeScript prüfen
npm test            # Tests App (jsdom) + Worker (Workers-Runtime)
npm run build       # Produktions-Build nach dist/
npm run preview     # Build lokal wie in Produktion testen
```

| Ordner         | Inhalt                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| `src/`         | React-App (PWA), reine Logik mit Tests in `src/lib/`                          |
| `worker/`      | Cloudflare Worker, API unter `/abfahrt/api/*`                                 |
| `public/`      | statische Dateien: `_headers` (Security-Header), `abfahrt/` (Manifest, Icons) |
| `test/worker/` | Worker-Tests                                                                  |

## Mitmachen & Sicherheit

- Ablauf und Regeln: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Sicherheitslücken vertraulich melden: [`SECURITY.md`](SECURITY.md)

## Lizenz

[AGPL-3.0](LICENSE). Wer den Code als eigenen Dienst betreibt, muss den Quellcode seiner Änderungen ebenfalls offenlegen.

Fahrplanauskünfte werden durch die jeweiligen Datenlieferanten zur Verfügung gestellt. Alle Angaben ohne Gewähr. Quellen: [`docs/01-datenquellen.md`](docs/01-datenquellen.md)
