# Architektur

## Überblick

```
 Handy / Browser (PWA, React)
        │  gleiche Domain, kein CORS-Problem
        ▼
 Cloudflare Worker  ──── Static Assets (React-Build)
   /abfahrt/api/*          ──── Cache (Cache API, 15–30 s)
   │  Adapter + Normalisierung + Rate-Limit
   ├──► VRR OpenService (EFA)     Rheinland, sekundengenau
   ├──► Transitous (MOTIS 2)      Deutschland, Fallback
   └──► VRR MIP / DB RIS (später)
 Cron-Trigger (M3) ──► Störungen prüfen ──► Web Push
 D1 (M3)           ──► Push-Abos
```

**Ein einziger Worker** liefert die App (Workers Static Assets) und die API unter `/abfahrt/api/*` aus:

- **Gleiche Origin:** Es braucht kein CORS, und Security-Header lassen sich zentral setzen.
- **Ein Deploy und eine Preview-URL** pro PR (`wrangler versions upload` → Preview-URL auf `workers.dev`)
- **API-Keys und User-Agent** leben nur im Worker.

## Unterpfad endlab.de/abfahrt

Die App läuft wie Spieltisch und Tasto als Worker-Route `endlab.de/abfahrt*` auf der gemeinsamen Domain `endlab.de`. Der Präfix steht zentral in `shared/base-path.ts`.

- Assets werden nach `abfahrt/assets/` gebaut und kommen ohne Worker-Aufruf aus den Static Assets. `/abfahrt/` liefert über den SPA-Fallback die `index.html`.
- Durch den Worker laufen nur `/abfahrt/api/*` und `/abfahrt` (301 auf `/abfahrt/`).
- **Gemeinsame Origin mit anderen Apps:** Alle `localStorage`-Schlüssel bekommen das Präfix `abfahrt:`. Der Service Worker (M1) bekommt nur den Scope `/abfahrt/`, Cookies gibt es nicht. HSTS wird ohne `includeSubDomains` gesetzt, damit eine einzelne App keine Regel für die ganze Domain festlegt.

## Frontend

- **React + Vite + TypeScript**, PWA über `vite-plugin-pwa` (Manifest, Service Worker, Offline-Shell)
- **Routing:** React Router (`createBrowserRouter`, `basename` = `BASE_PATH` aus `shared/base-path.ts`). Routen in `src/routes.tsx`:
  - `/abfahrt/` – Startseite mit Haltestellensuche
  - `/abfahrt/haltestelle/:stopId` – Live-Abfahrten; `stopId` ist die quellen-präfixierte ID aus der API, URL-kodiert (`vrr%3Ade%3A05111%3A18235`)
  - alles andere – „Seite nicht gefunden“. Direktaufrufe und Reloads funktionieren über den SPA-Fallback der Static Assets (lokal, in Produktion und auf `workers.dev`).
- **Datenabruf:** TanStack Query, Zugriff auf die API nur über `src/lib/api.ts` (Vertrag `shared/api-types.ts`, Antworten werden grob auf ihre Form geprüft). 4xx-Fehler werden nicht wiederholt, andere höchstens zweimal.
  - Suche: Debounce 250 ms, ab 2 Zeichen, Treffer 5 min gecacht
  - Abfahrten: `refetchInterval: 30_000`. Ein lokaler Ticker (15 s) aktualisiert nur den Countdown, ohne neuen Abruf.
- **Anzeige-Logik** als reine, getestete Module in `src/lib/`: `time.ts` (Countdown „jetzt“/„in N Min“/ab 60 Min Uhrzeit, Verspätung +N mit Farbton, Zeitzone Europe/Berlin), `departures.ts` (Sortierung nach tatsächlicher Abfahrtszeit, Gleiswechsel), `line-colors.ts` (Linienfarbe aus der API, sonst Fallback nach Verkehrsmittel). Linienfarben setzt React per CSSOM (`style`-Prop), das ist mit `style-src 'self'` erlaubt.
- **Karte:** MapLibre GL JS + OpenFreeMap
- **Speicher:** Favoriten in `localStorage` unter `abfahrt:favorites`, versioniert (`{ version: 1, items }`), robust gegen kaputte Daten, höchstens 20 Einträge, Abgleich zwischen Tabs über das `storage`-Ereignis (`src/lib/favorites.ts`, `src/hooks/use-favorites.ts`). Die Startseite teilt sich den Abfrage-Cache mit der Haltestellenseite (gleicher Query-Schlüssel). Export/Import per Link bzw. QR kommt später.
- **UI:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Preset „Vega“, Radix, Lucide-Icons, Schrift Inter lokal gebündelt). Komponenten liegen als Code in `src/components/ui/` und kommen per `npx shadcn@<version> add <name>` hinzu. Das CLI ist bewusst kein Projekt-Paket (bekannte Lücke in `deepmerge`), `src/styles/shadcn.css` ist lokal eingebunden.
- **Design:** klar und modern, große Countdown-Zahlen, Linienfarben als Akzent, Hell/Dunkel automatisch per `prefers-color-scheme`. Farb-Tokens in `src/index.css`, inkl. `success`/`warning` für pünktlich/verspätet.

## Worker-API (internes, quellenunabhängiges Format)

| Endpunkt                                         | Zweck                        | Meilenstein |
| ------------------------------------------------ | ---------------------------- | ----------- |
| `GET /abfahrt/api/stops/search?q=`               | Haltestellen/Adressen suchen | M1          |
| `GET /abfahrt/api/stops/nearby?lat=&lon=`        | Haltestellen in der Nähe     | M1          |
| `GET /abfahrt/api/departures?stop=&when=&modes=` | Abfahrten mit Echtzeit       | M1          |
| `GET /abfahrt/api/journeys?from=&to=&…`          | Verbindungssuche             | M2          |
| `GET /abfahrt/api/trips/:id`                     | Fahrtverlauf/Zwischenhalte   | M2          |
| `GET /abfahrt/api/alerts?lines=&stop=`           | Störungen                    | M3          |
| `POST /abfahrt/api/push/subscribe`               | Push-Abo                     | M3          |

Der Vertrag (Typen `Stop`, `Departure`, …) steht in `shared/api-types.ts` und wird von App und Worker gemeinsam genutzt.

**Haltestellen-IDs** tragen die Quelle als Präfix: `vrr:de:05111:18036` (DHID/IFOPT) oder `transitous:<id>`.

**Quellenwahl für Abfahrten** (`worker/api.ts`):

1. `transitous:`-IDs → Transitous `v5/stoptimes`
2. `vrr:`-IDs im **VRR-Gebiet** (Kreisschlüssel, 2. Teil der DHID, z. B. `05111` = Düsseldorf) **mit Echtzeit** → VRR-Abfahrtsmonitor (sekundengenau, inkl. Hinweisen)
3. `vrr:`-IDs außerhalb des VRR (dort liefert der VRR keine Echtzeit) → passende Transitous-Haltestelle per Geocoding im Umkreis von 500 m (Zuordnung 7 Tage gecacht), dann Transitous-Abfahrten
4. Notfalls Fahrplandaten vom VRR ohne Echtzeit

Die Suche nutzt den VRR-Stopfinder (deutschlandweit) und weicht bei Ausfall auf Transitous aus. Linienfarben liefert nur Transitous. Für VRR-Linien kommen sie in der App über eine Farbtabelle hinzu (Folge-Issue).

## Cloudflare-Free-Budget

Limits laut offizieller Doku (Stand 30.10.2026):

| Ressource                | Free-Limit                          | Unser Verbrauch (Schätzung)                                                 |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| Worker-Requests          | 100.000/Tag                         | 1 offene App = 120 Req./h. 20 Nutzer × 1 h/Tag ≈ 2.400/Tag ✅               |
| CPU pro Request          | 10 ms                               | JSON-Umbau kleiner Antworten < 2 ms ✅. Antworten per `limit` klein halten. |
| Subrequests pro Aufruf   | 50                                  | 1–2 pro API-Aufruf ✅                                                       |
| Cron-Trigger             | 5 pro Account                       | 1–2 (Störungs-Check/Push) ✅                                                |
| KV                       | 100.000 Reads, **1.000 Writes**/Tag | ungeeignet als Cache, nur für seltene Daten                                 |
| D1                       | 5 GB, 500 MB/DB                     | Push-Abos (M3) ✅                                                           |
| Durable Objects (SQLite) | 100.000 Req./Tag                    | Reserve, z. B. für Rate-Limit-Zähler                                        |
| Static Assets            | 20.000 Dateien, 25 MiB/Datei        | ✅                                                                          |

**Caching:** Die Cache API (`caches.default`) hält Abfahrten 30 s (Schlüssel auf die Minute gerundet), Haltestellensuchen 24 h und die VRR→Transitous-Zuordnung 7 Tage. Die Cache API greift auch auf `*.workers.dev`. Getestet am 13.11.2026 in Produktion mit dem Diagnose-Endpunkt `/api/cache-probe`: erster Aufruf `miss`, danach `hit`. Eine eigene Domain ist dafür nicht nötig.

**Transitous `/plan`:** Ein Zähler im Worker sorgt dafür, dass wir unter 720 Anfragen/24 h bleiben. Darüber nutzen wir nur VRR bzw. sprechen uns vorher mit Transitous ab.

## Sicherheit in der App

- **Security-Header** im Worker:
  - strikte `Content-Security-Policy` (nur eigene Origin + OpenFreeMap)
  - `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (Geolocation nur self)
- **Eingabevalidierung** aller `/api`-Parameter, z. B. mit `zod`. Keine Weiterleitung beliebiger URLs, der Worker ist kein offener Proxy.
- **Rate-Limit** pro IP im Worker (60 Anfragen/Minute je Isolate, `worker/rate-limit.ts`), Pflicht laut VRR-§6.2
- **User-Agent** `Abfahrt/<version> (+Repo-URL)` bei allen Anfragen an die Quellen, Pflicht laut Transitous-Policy
- **Keine personenbezogenen Daten:** keine Accounts, kein Tracking, keine Logs mit Standortdaten

## Pflicht-Quellhinweise (Impressum/„Über“-Seite + Ergebnislisten)

- VRR: Logo/Link + _„Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne Gewähr.“_
- Transitous: Link auf https://transitous.org/sources/
- © OpenStreetMap contributors, OpenFreeMap
