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
- **Repo:** erst privat mit Gratis-Scannern, später öffentlich mit GitHub-Rulesets

## Offene Punkte

1. **Transitous verlangt Open Source.** Die Nutzung ist nur erlaubt, wenn der Quellcode öffentlich unter einer Open-Source-Lizenz steht. Vorher sind nur leichte Prototyp-Tests erlaubt. Daraus folgt: **Spätestens bevor Familie und Freunde die App nutzen (Ende M1), muss das Repo öffentlich werden.** Vorschlag: Repo schon in M0 öffentlich machen und eine Lizenz wählen. Damit wären alle GitHub-Schutzfunktionen sofort gratis.
2. **Lizenz:** Vorschlag **AGPL-3.0** (wer den Code als Dienst weiterbetreibt, muss Änderungen offenlegen) oder **MIT** (maximal frei).
3. **VRR-Produktivzugang:** Die Nutzung ohne Registrierung ist nur für Test/Entwicklung/Hobby erlaubt. Spätestens vor der Freigabe an Familie und Freunde schickst du eine kurze Mail an `opendata-oepnv@vrr.de`, den Entwurf liefere ich.
4. **Cache auf `workers.dev`:** Wird beim ersten Deploy getestet (M0). Eine eigene Domain (≈ 10–15 €/Jahr) ist nicht nötig, solange das klappt.
