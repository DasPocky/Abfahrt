# Workflow & Sicherheit

## Ablauf jeder Aufgabe

1. **Issue:** Ich schlage es vor (Ziel, Inhalt, Akzeptanzkriterien), du nickst es ab. Ausnahme: Dependabot-PRs brauchen kein Issue.
2. **Branch** von `main`: `<typ>/<issue-nr>-<kurzname>`, z. B. `feat/12-abfahrtsmonitor`, `docs/1-konzept`
3. **Commits** nach [Conventional Commits](https://www.conventionalcommits.org/de/):
   - Format: `feat(worker): …`, `fix(ui): …`, `docs: …`, `chore: …`, `ci: …`
   - Alle Commits sind **signiert**.
4. **PR** gegen `main`:
   - Vorlage ausfüllen, `Closes #<nr>`
   - Preview-URL kommt automatisch
   - CI muss grün sein
5. **Merge:** Erst nach deinem OK merge ich, immer als **Merge-Commit (no-ff)**. Squash und Rebase sind tabu. Danach wird der Branch gelöscht.

**Labels:**
- Typ: `feature`, `bug`, `docs`, `security`, `infra`, `dependencies`
- Bereich: `frontend`, `worker`, `data`

## CI (GitHub Actions), parallele Jobs

| Job | Inhalt |
|---|---|
| `lint` | ESLint + Prettier-Check |
| `typecheck` | `tsc --noEmit` (App + Worker) |
| `test` | Vitest (App), Worker-Tests mit `@cloudflare/vitest-pool-workers` |
| `build` | Vite-Build + `wrangler deploy --dry-run` |
| `pr-title` | PR-Titel im Conventional-Commits-Format |
| `secrets` | gitleaks (komplette Historie) |
| `deps` | osv-scanner (bekannte Lücken in Abhängigkeiten) |
| `sast` | semgrep (Code-Analyse) |
| `preview` | nach `build`: Preview-Deploy, URL als PR-Kommentar |

**Laufzeit:** Alle Jobs laufen gleichzeitig, `concurrency` bricht veraltete Läufe ab, npm-Cache ist aktiv. Bei einem privaten Repo stehen 2.000 Action-Minuten pro Monat zur Verfügung. Das reicht für etwa 150 PR-Durchläufe.

## Sicherheitsmaßnahmen

| Maßnahme | Jetzt (privat, Free) | Nach Veröffentlichung |
|---|---|---|
| Kein direkter Push auf `main` | Abmachung + CI-Check | **Ruleset** erzwingt: nur PR, CI grün, kein Force-Push/Löschen, nur Merge-Commits, signierte Commits |
| Secret-Schutz | gitleaks in CI, `.gitignore` für `.env`/`.dev.vars` | + GitHub Secret-Scanning mit **Push-Schutz** |
| Abhängigkeiten | Dependabot (wöchentlich gesammelt, Security sofort) + osv-scanner | + Dependency-Review-Action |
| Code-Analyse | semgrep | + CodeQL |
| Actions gehärtet | Actions auf Commit-SHA gepinnt, `permissions:` minimal je Job, keine `pull_request_target`-Workflows | gleich |
| Cloudflare-Token | nur als GitHub-Secret, Rechte nur „Workers Scripts: Edit“ für einen Account | gleich |
| Meldeweg | `SECURITY.md` | + private Vulnerability Reports |

Beim Wechsel auf öffentlich ändern sich **nur Einstellungen**: Ruleset und Scans in GitHub aktivieren. Code und Workflows bleiben gleich.

## Was du einmalig tun musst

1. **SSH-Signier-Key** für deine eigenen Commits: GitHub → Settings → SSH and GPG keys → *New SSH key* → Typ **Signing Key**. Lokal:
   ```
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global commit.gpgsign true
   ```
2. **Cloudflare-API-Token für GitHub Actions** (in M0): Cloudflare-Dashboard → *My Profile* → *API Tokens* → Vorlage *Edit Cloudflare Workers*. Dann in GitHub unter *Settings → Secrets and variables → Actions* als `CLOUDFLARE_API_TOKEN` hinterlegen und `CLOUDFLARE_ACCOUNT_ID` ergänzen. Den Token sieht nur GitHub, ich bekomme ihn nie zu Gesicht.
