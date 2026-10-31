# Abfahrt

Echtzeit-ÖPNV-Auskunft als Progressive Web App – Fokus Düsseldorf/Rheinland, Ziel ganz Deutschland.

- Minutengenaue Live-Abfahrten
- Verbindungssuche mit Echtzeit
- Störungen & Meldungen
- Favoriten & Pendlerstrecken

Läuft komplett auf Cloudflare (Free-Plan). Konzept und Datenquellen: siehe [`docs/`](docs/).

## Live

- App: https://abfahrt.bjoern-ef9.workers.dev
- Jeder PR bekommt automatisch eine eigene Preview-URL (Kommentar im PR).

## Entwicklung

Voraussetzung: Node.js 26 LTS (siehe `.nvmrc`)

```bash
npm ci              # Abhängigkeiten installieren
npm run dev         # App + Worker lokal (http://localhost:5173)
npm run lint        # Oxlint (typgestützt) + Prettier
npm run typecheck   # Worker-Typen erzeugen + TypeScript prüfen
npm test            # Tests App (jsdom) + Worker (Workers-Runtime)
npm run build       # Produktions-Build nach dist/
npm run preview     # Build lokal wie in Produktion testen
```

| Ordner         | Inhalt                                                |
| -------------- | ----------------------------------------------------- |
| `src/`         | React-App (PWA)                                       |
| `worker/`      | Cloudflare Worker, API unter `/api/*`                 |
| `public/`      | statische Dateien, u. a. `_headers` (Security-Header) |
| `test/worker/` | Worker-Tests                                          |

## Mitmachen & Sicherheit

- Ablauf und Regeln: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Sicherheitslücken vertraulich melden: [`SECURITY.md`](SECURITY.md)

## Lizenz

[AGPL-3.0](LICENSE). Wer den Code als eigenen Dienst betreibt, muss den Quellcode seiner Änderungen ebenfalls offenlegen.

Fahrplanauskünfte werden durch die jeweiligen Datenlieferanten zur Verfügung gestellt. Alle Angaben ohne Gewähr. Quellen: [`docs/01-datenquellen.md`](docs/01-datenquellen.md)
