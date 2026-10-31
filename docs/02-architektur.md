# Architektur

## Überblick

```
 Handy / Browser (PWA, React)
        │  gleiche Domain, kein CORS-Problem
        ▼
 Cloudflare Worker  ──── Static Assets (React-Build)
   /api/*            ──── Cache (Cache API, 15–30 s)
   │  Adapter + Normalisierung + Rate-Limit
   ├──► VRR OpenService (EFA)     Rheinland, sekundengenau
   ├──► Transitous (MOTIS 2)      Deutschland, Fallback
   └──► VRR MIP / DB RIS (später)
 Cron-Trigger (M3) ──► Störungen prüfen ──► Web Push
 D1 (M3)           ──► Push-Abos
```

**Ein einziger Worker** liefert die App (Workers Static Assets) und die API unter `/api/*` aus:

- **Gleiche Origin:** Es braucht kein CORS, und Security-Header lassen sich zentral setzen.
- **Ein Deploy und eine Preview-URL** pro PR (`wrangler versions upload` → Preview-URL auf `workers.dev`)
- **API-Keys und User-Agent** leben nur im Worker.

## Frontend

- **React + Vite + TypeScript**, PWA über `vite-plugin-pwa` (Manifest, Service Worker, Offline-Shell)
- **Routing:** React Router. **Datenabruf:** TanStack Query mit `refetchInterval: 30_000`. Der Countdown läuft zwischen den Abrufen lokal weiter.
- **Karte:** MapLibre GL JS + OpenFreeMap
- **Speicher:** Favoriten und Einstellungen in `localStorage`, versioniert. Export/Import per Link bzw. QR kommt später.
- **Design:** klar und modern, große Countdown-Zahlen, Linienfarben als Akzent, Hell/Dunkel automatisch per `prefers-color-scheme`

## Worker-API (internes, quellenunabhängiges Format)

| Endpunkt                                 | Zweck                        | Meilenstein |
| ---------------------------------------- | ---------------------------- | ----------- |
| `GET /api/stops/search?q=`               | Haltestellen/Adressen suchen | M1          |
| `GET /api/stops/nearby?lat=&lon=`        | Haltestellen in der Nähe     | M1          |
| `GET /api/departures?stop=&when=&modes=` | Abfahrten mit Echtzeit       | M1          |
| `GET /api/journeys?from=&to=&…`          | Verbindungssuche             | M2          |
| `GET /api/trips/:id`                     | Fahrtverlauf/Zwischenhalte   | M2          |
| `GET /api/alerts?lines=&stop=`           | Störungen                    | M3          |
| `POST /api/push/subscribe`               | Push-Abo                     | M3          |

Haltestellen-IDs sind **global eindeutige DHID/IFOPT-Kennungen** (z. B. `de:05111:18036`). VRR und Transitous verwenden beide diese Kennungen. Darüber entscheidet der Worker, welche Quelle zuständig ist.

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

**Caching:** Die Cache API (`caches.default`) hält Abfahrten 15–30 s und Haltestellensuchen 24 h. Ob die Cache API auf `*.workers.dev` greift, ist in der Doku nicht eindeutig (sicher ist es nur für Custom Domains). Das wird beim ersten Deploy getestet. Fallback ist ein In-Memory-Cache pro Isolate.

**Transitous `/plan`:** Ein Zähler im Worker sorgt dafür, dass wir unter 720 Anfragen/24 h bleiben. Darüber nutzen wir nur VRR bzw. sprechen uns vorher mit Transitous ab.

## Sicherheit in der App

- **Security-Header** im Worker:
  - strikte `Content-Security-Policy` (nur eigene Origin + OpenFreeMap)
  - `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (Geolocation nur self)
- **Eingabevalidierung** aller `/api`-Parameter, z. B. mit `zod`. Keine Weiterleitung beliebiger URLs, der Worker ist kein offener Proxy.
- **Rate-Limit** pro IP im Worker, Pflicht laut VRR-§6.2
- **Keine personenbezogenen Daten:** keine Accounts, kein Tracking, keine Logs mit Standortdaten

## Pflicht-Quellhinweise (Impressum/„Über“-Seite + Ergebnislisten)

- VRR: Logo/Link + _„Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne Gewähr.“_
- Transitous: Link auf https://transitous.org/sources/
- © OpenStreetMap contributors, OpenFreeMap
