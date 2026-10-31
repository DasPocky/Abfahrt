# Mitarbeit

## Ablauf

1. **Issue** zuerst: Jede Aufgabe beginnt mit einem Issue, das Ziel, Inhalt und Akzeptanzkriterien enthält. Ausnahme: Dependabot-PRs.
2. **Branch** von `main`: `<typ>/<issue-nr>-<kurzname>`, z. B. `feat/12-abfahrtsmonitor`
3. **Commits** nach [Conventional Commits](https://www.conventionalcommits.org/de/) und **signiert**
   - Typen: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `perf`, `build`
   - Optionaler Bereich: `feat(worker): …`, `fix(ui): …`
4. **Pull Request** gegen `main`: Vorlage ausfüllen, `Closes #<nr>`, CI muss grün sein
5. **Merge** nur nach Freigabe und nur als **Merge-Commit** (kein Squash, kein Rebase), danach wird der Branch gelöscht.

## Regeln

- Kein direkter Push auf `main`
- Keine Secrets im Repo. Lokale Werte gehören in `.dev.vars` bzw. `.env`, beide sind in `.gitignore`.
- Datenquellen nur über den Worker abfragen und die Nutzungsbedingungen einhalten, siehe [`docs/01-datenquellen.md`](docs/01-datenquellen.md).

Details: [`docs/04-workflow-sicherheit.md`](docs/04-workflow-sicherheit.md)
