# Konzept „Abfahrt“

Echtzeit-ÖPNV-PWA mit Fokus Düsseldorf/Rheinland und Abdeckung von ganz Deutschland. Sie läuft komplett im Cloudflare-Free-Plan.

| Dokument                                                | Inhalt                                                |
| ------------------------------------------------------- | ----------------------------------------------------- |
| [01 – Datenquellen](01-datenquellen.md)                 | Recherche, Live-Tests, Lizenzen, Limits               |
| [02 – Architektur](02-architektur.md)                   | Aufbau, Worker-API, Cloudflare-Budget, App-Sicherheit |
| [03 – Roadmap](03-roadmap.md)                           | Meilensteine M0–M4                                    |
| [04 – Workflow & Sicherheit](04-workflow-sicherheit.md) | Issues, Branches, PRs, CI, Repo-Schutz                |
| [05 – Echtzeit-Abdeckung](05-echtzeit-abdeckung.md)     | Deutschlandweite Prüfung, Lücken, mögliche Quellen    |
| [06 – Bedienung](06-bedienung.md)                       | So funktioniert die App im Alltag                     |
| [07 – Barrierefreiheit](07-barrierefreiheit.md)         | Ziel WCAG 2.2 AA, Tests, Prüfprotokoll                |

## Getroffene Entscheidungen

- **Zielgruppe:** erst ich + Familie/Freunde, später öffentlich
- **Plattform:** PWA mit React + Vite + TypeScript
- **Betrieb:** Cloudflare Workers mit Static Assets, nur Free-Plan, keine laufenden Kosten
- **Speicher:** Favoriten lokal im Gerät, keine Accounts
- **Daten:** immer mehrere Quellen, wo möglich, und je Region die beste (Stand: VRR OpenService im VRR-Gebiet, Transitous für ganz Deutschland und als Fallback; regionale Quellen kommen dazu, siehe [Echtzeit-Abdeckung](05-echtzeit-abdeckung.md))
- **Reihenfolge:** M1 Abfahrtsmonitor + Favoriten → M2 Verbindungen → M3 Störungen/Push → M4 Extras
- **Workflow:** Issue → Branch → PR → Merge-Commit (no-ff) nach OK, Conventional Commits, signierte Commits
- **Repo:** seit 31.10.2026 **öffentlich** (Bedingung von Transitous). Damit stehen GitHub-Rulesets, CodeQL, Secret-Push-Schutz und unbegrenzte Action-Minuten gratis zur Verfügung.
- **Lizenz:** AGPL-3.0

## Offene Punkte

1. **VRR-Produktivzugang:** Der Mailtext an `opendata-oepnv@vrr.de` liegt bereit (#7). Abgeschickt wird er, sobald es eine richtige Produktivumgebung gibt.
2. **Registrierungen für weitere Quellen:** DB API Marketplace, RMV, HVV, VBN – siehe [Echtzeit-Abdeckung](05-echtzeit-abdeckung.md#zugang-zu-den-quellen).
3. ~~**Cache auf `workers.dev`**~~: ✅ funktioniert (Test 13.11.2026), keine eigene Domain nötig.
