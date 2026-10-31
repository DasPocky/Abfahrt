# Konzept „Abfahrt“

Echtzeit-ÖPNV-PWA mit Fokus Düsseldorf/Rheinland und Abdeckung von ganz Deutschland. Sie läuft komplett im Cloudflare-Free-Plan.

| Dokument | Inhalt |
|---|---|
| [01 – Datenquellen](01-datenquellen.md) | Recherche, Live-Tests, Lizenzen, Limits |
| [02 – Architektur](02-architektur.md) | Aufbau, Worker-API, Cloudflare-Budget, App-Sicherheit |
| [03 – Roadmap](03-roadmap.md) | Meilensteine M0–M4 |
| [04 – Workflow & Sicherheit](04-workflow-sicherheit.md) | Issues, Branches, PRs, CI, Repo-Schutz |

## Getroffene Entscheidungen

- **Zielgruppe:** erst ich + Familie/Freunde, später öffentlich
- **Plattform:** PWA mit React + Vite + TypeScript
- **Betrieb:** Cloudflare Workers mit Static Assets, nur Free-Plan, keine laufenden Kosten
- **Speicher:** Favoriten lokal im Gerät, keine Accounts
- **Daten:** VRR OpenService als Primärquelle, Transitous für ganz Deutschland und als Fallback
- **Reihenfolge:** M1 Abfahrtsmonitor + Favoriten → M2 Verbindungen → M3 Störungen/Push → M4 Extras
- **Workflow:** Issue → Branch → PR → Merge-Commit (no-ff) nach OK, Conventional Commits, signierte Commits
- **Repo:** seit 31.10.2026 **öffentlich** (Bedingung von Transitous). Damit stehen GitHub-Rulesets, CodeQL, Secret-Push-Schutz und unbegrenzte Action-Minuten gratis zur Verfügung.
- **Lizenz:** AGPL-3.0

## Offene Punkte

1. **VRR-Produktivzugang:** Ich liefere in M0 den Mailtext an `opendata-oepnv@vrr.de`, du schickst ihn ab.
2. **Cache auf `workers.dev`:** Wird beim ersten Deploy getestet (M0). Eine eigene Domain ist nicht nötig, solange das klappt.
