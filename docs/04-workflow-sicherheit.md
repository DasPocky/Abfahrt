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

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Job                 | Inhalt                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `lint`              | Oxlint mit Typprüfung (`--type-aware`, basiert auf TypeScript 7) + Prettier-Check |
| `typecheck`         | `wrangler types` + `tsc -b` mit TypeScript 7 (App, Worker, Configs)               |
| `test`              | Vitest (App), Worker-Tests mit `@cloudflare/vitest-plugin`                        |
| `build`             | Vite-Build + `wrangler deploy --dry-run`                                          |
| `audit`             | `npm audit` (ab „moderate“) + `npm audit signatures` (Registry-Signaturen)        |
| `dependency-review` | nur PRs: neue/geänderte Abhängigkeiten mit bekannten Lücken blockieren            |
| `secrets`           | gitleaks (komplette Historie)                                                     |
| `pr-title`          | nur PRs: Titel im Conventional-Commits-Format                                     |
| CodeQL              | Code-Analyse über GitHub „Default setup“ (eigener Workflow von GitHub)            |

**Laufzeit:** Alle Jobs laufen gleichzeitig, `concurrency` bricht veraltete Läufe eines PRs ab, npm-Cache ist aktiv.

## Deploy (Cloudflare Workers)

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

| Ereignis         | Job                                     | Ergebnis                                                                                                                                              |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR gegen `main`  | `preview` (Environment `preview`)       | `wrangler versions upload` mit Alias `pr-<nr>`, die URL kommt als PR-Kommentar und wird bei jedem Push aktualisiert. Die Produktion bleibt unberührt. |
| Merge auf `main` | `production` (Environment `production`) | `wrangler deploy`, danach Smoke-Test auf `/api/health`                                                                                                |

- **Produktion:** https://abfahrt.bjoern-ef9.workers.dev
- **Preview pro PR:** `https://pr-<nr>-abfahrt.bjoern-ef9.workers.dev`
- PRs aus Forks bekommen keine Secrets und werden nicht deployt.
- **Rollback:** Cloudflare-Dashboard → Workers → `abfahrt` → _Deployments_, frühere Version auswählen, oder lokal `npx wrangler rollback`.

**Prüfung der Workflows:** Vor Änderungen an `.github/` lokal `actionlint` und `zizmor` laufen lassen.

## Sicherheitsmaßnahmen

| Maßnahme                      | Im Repo / CI                                                                                                                                                                                    | GitHub-Einstellung (öffentliches Repo)                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kein direkter Push auf `main` | Abmachung + CI-Check                                                                                                                                                                            | **Ruleset** erzwingt: nur PR, CI grün, kein Force-Push/Löschen, nur Merge-Commits, signierte Commits |
| Secret-Schutz                 | gitleaks in CI, `.gitignore` für `.env`/`.dev.vars`                                                                                                                                             | + GitHub Secret-Scanning mit **Push-Schutz**                                                         |
| Abhängigkeiten                | Dependabot (wöchentlich gesammelt, 7 Tage Cooldown, Security sofort), Versionen exakt gepinnt, Installationsskripte verboten (`allowScripts`), `npm audit` + Signaturprüfung, Dependency-Review | Dependabot alerts, security updates, Malware alerts                                                  |
| Code-Analyse                  | –                                                                                                                                                                                               | CodeQL (Default setup)                                                                               |
| Actions gehärtet              | Actions auf Commit-SHA gepinnt, `permissions:` minimal je Job, keine `pull_request_target`-Workflows                                                                                            | gleich                                                                                               |
| Cloudflare-Token              | nur als GitHub-Secret, eigenes Token nur für GitHub Actions mit „Workers Scripts: Edit“ auf ein Konto                                                                                           | gleich                                                                                               |
| Meldeweg                      | `SECURITY.md`                                                                                                                                                                                   | + private Vulnerability Reports                                                                      |

Das Repo ist seit 31.10.2026 öffentlich. Die GitHub-Einstellungen in der rechten Spalte schaltet der Repo-Owner ein, ein Teil davon setzt die CI-Jobs voraus (Ruleset: Pflicht-Checks). Action-Minuten sind unbegrenzt.

## Was du einmalig tun musst

1. **SSH-Signier-Key** für deine eigenen Commits: GitHub → Settings → SSH and GPG keys → _New SSH key_ → Typ **Signing Key**. Lokal:
   ```
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global commit.gpgsign true
   ```
2. **Cloudflare-API-Token für GitHub Actions:**
   - Cloudflare-Dashboard → _My Profile_ → _API Tokens_ → _Create Token_ → _Create Custom Token_
   - Permissions: **Account → Workers Scripts → Edit**
   - Account Resources: **Include → EndLab**
   - Optional: _TTL_ (Ablaufdatum) setzen
   - In GitHub unter _Settings → Secrets and variables → Actions_:
     - Tab **Secrets** → _New repository secret_ → Name `CLOUDFLARE_API_TOKEN`, Wert = Token
     - Tab **Variables** → _New repository variable_ → Name `CLOUDFLARE_ACCOUNT_ID`, Wert = Account-ID (nicht geheim)
   - Den Token sieht nur GitHub, er landet nie im Chat oder im Repo.
