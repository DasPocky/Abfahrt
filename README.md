# Abfahrt

Echtzeit-ÖPNV-Auskunft als Progressive Web App – Fokus Düsseldorf/Rheinland, Ziel ganz Deutschland.

- Minutengenaue Live-Abfahrten
- Verbindungssuche mit Echtzeit
- Störungen & Meldungen
- Favoriten & Pendlerstrecken

Läuft komplett auf Cloudflare (Free-Plan). Konzept und Datenquellen: siehe [`docs/`](docs/).

## Bedienung

1. Auf der Startseite den Namen einer Haltestelle eingeben (ab 2 Zeichen erscheinen Vorschläge).
2. Treffer antippen – oder per Tastatur: Pfeil runter/hoch wählt, Enter öffnet, Esc leert die Suche.
3. Die Abfahrtsseite (`/abfahrt/haltestelle/<id>`) lädt alle 30 Sekunden neu, der Countdown läuft dazwischen weiter. Der Link lässt sich als Lesezeichen speichern.
4. **Filtern:** Über der Liste stehen die Verkehrsmittel, die an der Haltestelle fahren (z. B. S-Bahn, U-Bahn, Bus). Antippen filtert, mehrere sind möglich. Über das **Filter-Symbol** rechts gibt es Linien, Gleis/Steig und „Abfahrten ab“ (Uhrzeit). Der Filter steht in der Adresse, der Link lässt sich also teilen.
5. Mit dem **Stern** wird die aktuelle Ansicht zum Favoriten, inklusive Filter. Dieselbe Haltestelle kann mehrfach gespeichert werden (z. B. „Hbf · S-Bahn“ und „Hbf · U-Bahn“). Favoriten erscheinen auf der Startseite unter „Meine Haltestellen“ mit den nächsten Abfahrten. Über **Bearbeiten** lassen sie sich umbenennen, verschieben und entfernen. Sie werden nur im eigenen Browser gespeichert.

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
