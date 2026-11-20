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

## Deploy (Cloudflare Workers Builds)

Cloudflare baut selbst, sobald auf GitHub gepusht wird. In GitHub liegt kein Cloudflare-Token.

| Feld (Workers & Pages → abfahrt → Settings → Builds) | Wert                    |
| ---------------------------------------------------- | ----------------------- |
| Production branch                                    | `main`                  |
| Build command                                        | `npm run cf:build`      |
| Deploy command                                       | `npm run cf:deploy`     |
| Version command                                      | `npm run cf:preview`    |
| API token                                            | `endlab-workers-builds` |

| Ereignis         | Ergebnis                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Push auf Zweig   | `cf:build` (Lint, Tests, Build, Probe-Deploy), dann `cf:preview`: Migrationen auf `abfahrt-push-vorschau`, `wrangler preview` |
| Merge auf `main` | `cf:build`, dann `cf:deploy`: Migrationen auf `abfahrt-push`, `wrangler deploy`                                               |

- **Stufen:** Test lokal und in GitHub Actions, Staging als Vorschau je Zweig mit eigener Push-Datenbank (`previews` in `wrangler.jsonc`), Live auf `main`.
- **Produktion:** https://endlab.de/abfahrt (Route `endlab.de/abfahrt*` auf der Zone `endlab.de`)
- **Vorschau je Zweig:** Adresse steht im Build unter Workers & Pages → abfahrt → Deployments; nach dem Merge wird sie gelöscht (`npx wrangler preview delete --name <zweig>`).
- **Rollback:** Cloudflare-Dashboard → Workers → `abfahrt` → _Deployments_, frühere Version auswählen, oder `npx wrangler rollback`.

**Web Push:** D1 `abfahrt-push` (Staging: `abfahrt-push-vorschau`), privater Schlüssel als Worker-Secret `VAPID_PRIVATE_JWK`. Ein neuer Schlüssel macht alle Push-Abos ungültig und wird nur bewusst gesetzt (`npx wrangler secret put VAPID_PRIVATE_JWK`).

**Prüfung der Workflows:** Vor Änderungen an `.github/` lokal `actionlint` und `zizmor` laufen lassen.

## Sicherheitsmaßnahmen

| Maßnahme                      | Im Repo / CI                                                                                                                                                                                    | GitHub-Einstellung (öffentliches Repo)                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kein direkter Push auf `main` | Abmachung + CI-Check                                                                                                                                                                            | **Ruleset** erzwingt: nur PR, CI grün, kein Force-Push/Löschen, nur Merge-Commits, signierte Commits |
| Secret-Schutz                 | gitleaks in CI, `.gitignore` für `.env`/`.dev.vars`                                                                                                                                             | + GitHub Secret-Scanning mit **Push-Schutz**                                                         |
| Abhängigkeiten                | Dependabot (wöchentlich gesammelt, 7 Tage Cooldown, Security sofort), Versionen exakt gepinnt, Installationsskripte verboten (`allowScripts`), `npm audit` + Signaturprüfung, Dependency-Review | Dependabot alerts, security updates, Malware alerts                                                  |
| Code-Analyse                  | –                                                                                                                                                                                               | CodeQL (Default setup)                                                                               |
| Actions gehärtet              | Actions auf Commit-SHA gepinnt, `permissions:` minimal je Job, keine `pull_request_target`-Workflows                                                                                            | gleich                                                                                               |
| Cloudflare-Token              | keiner in GitHub; Workers Builds baut mit dem Token `endlab-workers-builds` in Cloudflare                                                                                                       | gleich                                                                                               |
| Meldeweg                      | `SECURITY.md`                                                                                                                                                                                   | + private Vulnerability Reports                                                                      |

Das Repo ist seit 31.10.2026 öffentlich. Die GitHub-Einstellungen in der rechten Spalte schaltet der Repo-Owner ein, ein Teil davon setzt die CI-Jobs voraus (Ruleset: Pflicht-Checks). Action-Minuten sind unbegrenzt.

## Was du einmalig tun musst

1. **SSH-Signier-Key** für deine eigenen Commits: GitHub → Settings → SSH and GPG keys → _New SSH key_ → Typ **Signing Key**. Lokal:
   ```
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global commit.gpgsign true
   ```

## Eigene Fixes für Abhängigkeiten

Gibt es für eine Sicherheitslücke in einer Abhängigkeit noch keinen offiziellen Patch, fixen wir sie
notfalls selbst in `vendor/` und binden die Kopie per `overrides` ein. Pflicht dabei: Begründung,
Prüfung (offizielle Testsuite, Vergleich mit dem Original) und Weg zum Entfernen in
`vendor/README.md`, ein Regressionstest, ein Issue zum Entfernen und eine automatische Überwachung
auf den offiziellen Patch. **Sobald es ihn gibt, ersetzen wir den eigenen Fix wieder durch das
offizielle Paket.**

| Paket     | Lücke                                     | Issue | Überwachung                                                    |
| --------- | ----------------------------------------- | ----- | -------------------------------------------------------------- |
| picomatch | GHSA-fc5q-39xc-vjpf, picomatch-Issue #175 | #137  | `.github/workflows/picomatch-watch.yml`, montags, schlägt fehl |
