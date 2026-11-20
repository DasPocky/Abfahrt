# Hinweise für Claude

Abfahrt ist eine Echtzeit-ÖPNV-PWA (React + Cloudflare Worker + D1). Überblick:
`README.md`, Konzept: `docs/README.md`, Ablauf und Regeln: `CONTRIBUTING.md`,
Betrieb: `docs/04-workflow-sicherheit.md`.

## Zusammenarbeit (gilt in allen EndLab-Repos)

- Immer auf **Deutsch**, per **du**, kurz und direkt. Entscheidungen mit
  Optionen und Empfehlung vorlegen.
- **Jede Änderung als PR.** Vorher Vorschau-Link und Screenshots im
  Handy-Format zeigen.
- **Vor jedem Merge fragen.** Gemergt wird erst, wenn Björn „merge“ schreibt.
  Jeder Merge auf `main` geht sofort live.
- **Keine Geheimnisse** im Chat, im Code oder in GitHub. Secrets setzt Björn
  in Cloudflare.
- Deploy nur über **Cloudflare Workers Builds**, nie von Hand und nie aus
  GitHub Actions. GitHub Actions prüfen nur.
- Nichts darf hängen bleiben: Jede Änderung am Betrieb hat einen Rückweg.
- **Vollbild auf dem Handy:** Die App reicht bis an alle Ränder
  (`viewport-fit=cover`, Statusleiste durchscheinend, Hintergrund auch auf
  `<html>`). Nichts Bedienbares unter Notch, Kamera-Loch oder Home-Leiste:
  Abstände mit `env(safe-area-inset-*)`, Dialoge und Blätter nie höher als der
  freie Bereich, auch im Querformat.
- **Keine Ideen, Konzepte oder Pläne im Repo.** Ins Repo kommt nur, was gebaut
  ist und gilt: Code, Tests, Betriebsdoku, CLAUDE.md. Vorschläge nur im Chat.

## Arbeiten im Repo

- Ablauf nach `CONTRIBUTING.md`: Issue, Conventional Commits, Merge-Commit.
- Vor dem Commit: `npm run check` (Lint, Tests, Build, Probe-Deploy).
- Das Repo ist öffentlich (Bedingung von Transitous) und muss es bleiben.
- Datenbankänderungen nur als neue Datei in `migrations/`; sie laufen beim
  Deploy automatisch, live und in der Vorschau.
