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
- **Gemeinsame Origin mit anderen Apps:** Alle `localStorage`-Schlüssel bekommen das Präfix `abfahrt:`. Der Service Worker liegt unter `/abfahrt/sw.js` und hat nur den Scope `/abfahrt/`, seine Caches heißen `abfahrt-shell-<version>`. Cookies gibt es nicht. HSTS wird ohne `includeSubDomains` gesetzt, damit eine einzelne App keine Regel für die ganze Domain festlegt.

## Frontend

- **React + Vite + TypeScript**, PWA mit eigenem kleinen Service Worker (ohne Zusatzpaket), siehe [PWA und Service Worker](#pwa-und-service-worker)
- **Routing:** React Router (`createBrowserRouter`, `basename` = `BASE_PATH` aus `shared/base-path.ts`). Routen in `src/routes.tsx`:
  - `/abfahrt/` – Startseite mit Haltestellensuche
  - `/abfahrt/haltestelle/:stopId` – Live-Abfahrten; `stopId` ist die quellen-präfixierte ID aus der API, URL-kodiert (`vrr%3Ade%3A05111%3A18235`)
  - `/abfahrt/karte` – Karte mit Haltestellen (lazy geladen, siehe [Karte](#karte))
  - `/abfahrt/ueber` – Über die App: Zweck, Pflicht-Quellhinweise, Datenschutz, Quellcode (verlinkt im Fußbereich jeder Seite)
  - alles andere – „Seite nicht gefunden“. Direktaufrufe und Reloads funktionieren über den SPA-Fallback der Static Assets (lokal, in Produktion und auf `workers.dev`).
- **Datenabruf:** TanStack Query, Zugriff auf die API nur über `src/lib/api.ts` (Vertrag `shared/api-types.ts`, Antworten werden grob auf ihre Form geprüft). 4xx-Fehler werden nicht wiederholt, andere höchstens zweimal.
  - Suche: Debounce 250 ms, ab 2 Zeichen, Treffer 5 min gecacht
  - Abfahrten: `refetchInterval: 30_000`. Ein lokaler Ticker (15 s) aktualisiert nur den Countdown, ohne neuen Abruf.
- **Anzeige-Logik** als reine, getestete Module in `src/lib/`: `time.ts` (Countdown „jetzt“/„in N Min“/ab 60 Min Uhrzeit, Verspätung +N mit Farbton, „pünktlich“ statt „+0“, Zeitzone Europe/Berlin), `departures.ts` (Sortierung nach tatsächlicher Abfahrtszeit, Gleiswechsel), `line-colors.ts` (Linienfarbe aus der API, sonst Fallback nach Verkehrsmittel), `notices.ts` (Hinweise aufteilen: gleicher Text bei mindestens zwei Abfahrten wird zum Sammelhinweis der Haltestelle). Linienfarben setzt React per CSSOM (`style`-Prop), das ist mit `style-src 'self'` erlaubt.
- **Hinweise:** In der Abfahrtszeile steht nur ein ⓘ-Button (mit Anzahl ab zwei Hinweisen), Sammelhinweise einmal über der Liste („N Hinweise für diese Haltestelle“). Beide öffnen ein Panel von unten (shadcn `Sheet` auf Basis des Radix-Dialogs) mit dem vollen Text; Sammelhinweise zählen in den Zeilen nicht mit.
- **Karte:** MapLibre GL JS + OpenFreeMap, siehe [Karte](#karte)
- **Suche nach Nähe:** Der Worker liefert bis zu 40 Treffer mit `relevance` (Passgenauigkeit des VRR-Stopfinders 0–1000). Die App sortiert sie **im Browser** nach `relevance − 120 · log2(1 + km/2)` und zeigt die besten 10 mit Entfernung (`src/lib/geo.ts`). Der Standort (ungefähr, `enableHighAccuracy: false`) wird beim ersten Antippen der Suche einmal angefragt, die Wahl liegt unter `abfahrt:location` (`src/hooks/use-location.ts`). Für die Suche verlassen Koordinaten das Gerät nicht.
- **In der Nähe:** `stops/nearby` bekommt die Position auf 3 Nachkommastellen (~100 m) gerundet, schon von der App (`roundCoord` in `src/lib/api.ts`) und erneut im Worker. Quelle ist der VRR-`XML_COORD_REQUEST` (Umkreis 1 km, max. 12, liefert auch außerhalb des VRR), Fallback Transitous `reverse-geocode`. Cache 24 h je gerundeter Position, Antwort `private, max-age=300`. Entfernung und Reihenfolge berechnet die App mit der genauen Position, die Startseite zeigt die nächsten 4, der Rest per „Alle anzeigen“.
- **Filter:** Verkehrsmittel, Linien, Gleise und Zeitpunkt (`src/lib/filters.ts`) stehen in der URL (`?vm=suburban,subway&linie=S6&gleis=13&zeit=<ISO>`), dadurch sind sie teilbar und als Lesezeichen nutzbar. Die Auswahl der Chips wird aus den aktuellen Abfahrten abgeleitet. Gefiltert wird in der App, der Worker liefert immer alle Abfahrten der Haltestelle (ein gemeinsamer Cache-Eintrag für alle Nutzer).
- **Speicher:** Favoriten in `localStorage` unter `abfahrt:favorites`, Format **Version 2**: `{ version: 2, items: [{ stopId, name, place?, label?, filter }] }`. Ein Favorit ist Haltestelle + Filter (ohne Zeitpunkt), dieselbe Haltestelle darf mehrfach vorkommen. Version 1 (ohne Filter) wird beim Lesen automatisch übernommen. Robust gegen kaputte Daten, höchstens 20 Einträge, Abgleich zwischen Tabs über das `storage`-Ereignis (`src/lib/favorites.ts`, `src/hooks/use-favorites.ts`). Export/Import per Link bzw. QR kommt später.
- **UI:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Preset „Vega“, Radix, Lucide-Icons, Schrift Inter lokal gebündelt). Komponenten liegen als Code in `src/components/ui/` und kommen per `npx shadcn@<version> add <name>` hinzu. Das CLI ist bewusst kein Projekt-Paket (bekannte Lücke in `deepmerge`), `src/styles/shadcn.css` ist lokal eingebunden.
- **Design:** klar und modern, große Countdown-Zahlen, Linienfarben als Akzent, Hell/Dunkel automatisch per `prefers-color-scheme`. Farb-Tokens in `src/index.css`, inkl. `success`/`warning` für pünktlich/verspätet.
- **Abfahrtszeile (Variante A, Standard, kompakt):** festes Raster Linienfeld (Linienfarbe + Verkehrsmittel-Symbol, bei langen Bezeichnungen wie „ICE 1023“ ohne Symbol) | Ziel + „ab HH:MM“ mit Verspätung/„pünktlich“ | **Halteplatz-Kästchen** | Countdown (Zahl + „Min“). Darunter optional eine schlanke **Hinweiszeile** (gekürzt, antippbar, gleicher Stil wie der Haltestellen-Hinweis). Halteplatz als kleines Kästchen (`platformLabel` in `src/lib/modes.ts`): **Gleis** für Schienenverkehr inkl. U-Bahn, **Steig** für Bus und Tram, „Anleger“ für Fähren. Ob Bahn- oder U-Bahn-Gleis gemeint ist, zeigt die Linie (Entscheidung 14.11.2026, Piktogramme und „U-Gleis“ verworfen). Gleiswechsel in Orange mit „statt 4“. Varianten B (Countdown links) und C (Karten mit Farbstreifen) sind für die Einstellungen vorgemerkt (#37).
- **Symbole:** ein Symbolsatz (lucide) in einheitlicher Größe, Strichstärke und Farbe; das eingebaute ✕ des Suchfelds ist ausgeblendet und durch ein eigenes ersetzt.
- **Panels** (Hinweise, Filter) nutzen das native `<dialog>` (`src/components/bottom-sheet.tsx`), weil Radix-Dialoge `<style>`-Elemente einfügen, die die CSP blockiert.

## Karte

- **Route** `/abfahrt/karte` (`src/pages/map-page.tsx`, Karte in `src/components/stop-map.tsx`). Eingebunden über `React.lazy` (`src/pages/lazy-map-page.tsx`): MapLibre steckt im eigenen Chunk `map-page-*.js` (ca. 1,07 MB, gzip ca. 290 kB) samt `map-page-*.css` (MapLibre-CSS als eigene Datei per `<link>`, kein Inline-`<style>`), dazu der MapLibre-Worker `maplibre-gl-worker-*.mjs` (ca. 520 kB). Das Haupt-Bundle wächst nur um ca. 3 kB (Einstieg, Lazy-Hülle). Der Service Worker nimmt diese Dateien **nicht** in die Offline-Hülle auf (`src/pwa/precache.ts`), der Browser lädt sie erst beim ersten Öffnen der Karte.
- **MapLibre GL JS** `maplibre-gl` (v6, ES-Module). Der Worker wird per `setWorkerUrl` auf die gebaute Datei der eigenen Origin gesetzt (Vite-Import `?url`). MapLibre startet ihn dann direkt als Modul-Worker, ohne Blob-URL und ohne `eval`. Einen eigenen „CSP-Build“ wie in v1–v4 braucht v6 deshalb nicht.
- **Kacheln:** OpenFreeMap-Vektorkacheln, Stil `liberty` (hell) bzw. `dark` (Dunkelmodus, folgt `prefers-color-scheme` und wechselt live). Rotation und Neigung sind aus. Der Quellhinweis „© OpenStreetMap-Mitwirkende, OpenFreeMap · OpenMapTiles“ steht immer sichtbar unten rechts (eigenes Element statt MapLibre-Attribution, damit er deutsch und nicht eingeklappt ist).
- **Haltestellen:** ab Zoomstufe 14 (`src/lib/map-area.ts`). Nach dem Verschieben wartet die App 400 ms (Debounce), beschneidet den Ausschnitt um die Mitte auf höchstens 0,048° × 0,078° (breite Fenster), rundet nach außen auf 3 Nachkommastellen und fragt `stops/area` (TanStack Query, 1 h frisch). Geladene Haltestellen bleiben beim Verschieben sichtbar (höchstens 2.000). Darstellung als GeoJSON-Kreise, ab Zoomstufe 16 mit Namen (Schrift von OpenFreeMap). Antippen (12 px Toleranz) zeigt eine Karte mit Namen und Link **Abfahrten** zur Haltestellenseite.
- **Start:** Standort, wenn in der App schon erlaubt (`abfahrt:location` = `on`, `useLocation`), sonst Düsseldorf Innenstadt (Zoom 15). Der Standort wird nur in der Karte gezeigt; an den Worker geht nur der Ausschnitt.

## PWA und Service Worker

- **Manifest** `public/abfahrt/manifest.webmanifest` (→ `/abfahrt/manifest.webmanifest`): `start_url`, `scope` und `id` `/abfahrt/`, `display: standalone`, `lang: de`. Icons in `public/abfahrt/icons/`: `icon.svg` (Quelle), PNG 192/512, maskierbar 192/512 (`icon-maskable.svg`, Symbol auf 80 % für die Safe Zone) und `apple-touch-icon.png` (180 px). Die PNGs sind aus den SVGs gerendert (Chromium). `index.html` verlinkt Manifest, Favicon und Apple-Touch-Icon und setzt `theme-color` getrennt für Hell (`#ffffff`) und Dunkel (`#0a0a0a`).
- **Service Worker** ohne Zusatzpaket: Vorlage `src/pwa/service-worker.js`. Ein kleines Vite-Plugin in `vite.config.ts` erzeugt daraus beim Build `dist/client/abfahrt/sw.js` und setzt die Dateiliste der App-Hülle und eine Version ein (`src/pwa/precache.ts`, getestet). Die Version ist ein Hash über alle gebauten Dateien, `public/` und die Vorlage. Jeder Build mit Änderungen ergibt also einen neuen Service Worker.
- **Registrierung** nur im Produktions-Build nach dem `load`-Ereignis (`src/pwa/register-service-worker.ts`) mit Scope `/abfahrt/`. Andere Pfade auf `endlab.de` bleiben unberührt.
- **Strategie:**
  - Beim Installieren landen `/abfahrt/` (die `index.html` über den SPA-Fallback), JS, CSS, die Schrift im Zeichensatz „latin“, Manifest und Icons im Cache `abfahrt-shell-<version>`.
  - Seitenaufrufe unter `/abfahrt/` gehen zuerst ans Netz. Offline liefert der Service Worker die gespeicherte `index.html`, die App startet und zeigt ihre Fehlermeldung.
  - Gebaute Dateien (Hash im Namen) kommen aus dem Cache, sonst aus dem Netz. Beim Abgleich wird `Vary: Origin` der Static Assets ignoriert.
  - `/abfahrt/api/*` wird nie angefasst und nie gecacht.
  - Ein neuer Service Worker übernimmt sofort (`skipWaiting`, `clients.claim`) und löscht nur ältere `abfahrt-shell-*`-Caches. Caches anderer Apps derselben Origin bleiben.
- **CSP:** `public/_headers` enthält zusätzlich `worker-src 'self'`. Er gilt auch für den MapLibre-Worker (eigene Datei, kein Blob). Ohne die Direktive griffe die Rückfallkette über `script-src` auf `'self'`. Ausdrücklich gesetzt ist klar, dass Worker nur von der eigenen Origin kommen dürfen, auch wenn `script-src` später einmal erweitert wird. Inline-Skripte braucht die PWA nicht.

## Worker-API (internes, quellenunabhängiges Format)

| Endpunkt                                         | Zweck                        | Meilenstein |
| ------------------------------------------------ | ---------------------------- | ----------- |
| `GET /abfahrt/api/stops/search?q=`               | Haltestellen/Adressen suchen | M1          |
| `GET /abfahrt/api/stops/nearby?lat=&lon=`        | Haltestellen in der Nähe     | M1          |
| `GET /abfahrt/api/stops/area?min=&max=`          | Haltestellen im Ausschnitt   | M1          |
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

Die Suche nutzt den VRR-Stopfinder (deutschlandweit) und weicht bei Ausfall auf Transitous aus.

**Haltestellen im Kartenausschnitt** (`worker/stops-area.ts`, `worker/sources/transitous-map.ts`): `min=<lat,lon>&max=<lat,lon>`, höchstens 0,05° × 0,08° (ca. 5,5 × 5,5 km, also nur bei ausreichendem Zoom), sonst `400 invalid_area`. Der Worker rundet nach außen auf 3 Nachkommastellen; das ist Cache-Schlüssel (`area:v1:…`, 24 h) und Anfrage an Transitous `v1/map/stops` zugleich. Transitous liefert einzelne Steige; der Worker fasst sie nach amtlicher Haltestellen-ID (DHID, auch aus anderen Datensätzen, z. B. `at-Railway…_de:05315:11201:7:79`) bzw. Eltern-ID zu Haltestellen zusammen, Name und Lage bevorzugt aus DELFI. Einträge ohne DHID im Umkreis von 300 m einer DHID-Haltestelle (Flixbus, niederländische Daten …) fallen als Dubletten weg. **IDs:** im VRR-Gebiet `vrr:<DHID>` (Antippen nutzt die VRR-Echtzeit), sonst `transitous:<ID>` (bevorzugt `de-DELFI_<DHID>`, sonst ein Steig, `v5/stoptimes` liefert dafür die ganze Haltestelle). Antwort im Format `StopSearchResponse` (id, name, lat, lon), höchstens 300 nach Bedeutung, `Cache-Control: public, max-age=3600`.

**Linienfarben** liefert nur Transitous. Für VRR-Abfahrten ergänzt der Worker sie aus einer Zuordnung Linie → Farbe je Haltestelle, gewonnen aus einer einzigen Transitous-Abfrage und 7 Tage gecacht (`worker/line-colors.ts`, Details in [`01-datenquellen.md`](01-datenquellen.md#linienfarben-für-vrr-abfahrten)). Die Abfahrten warten höchstens 2,5 s darauf; ohne Farben greift in der App der Fallback nach Verkehrsmittel.

## Cloudflare-Free-Budget

Limits laut offizieller Doku (Stand 30.10.2026):

| Ressource                | Free-Limit                          | Unser Verbrauch (Schätzung)                                                   |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| Worker-Requests          | 100.000/Tag                         | 1 offene App = 120 Req./h. 20 Nutzer × 1 h/Tag ≈ 2.400/Tag ✅                 |
| CPU pro Request          | 10 ms                               | JSON-Umbau kleiner Antworten < 2 ms ✅. Antworten per `limit` klein halten.   |
| Subrequests pro Aufruf   | 50                                  | 1–2 pro API-Aufruf, beim ersten Abruf einer Haltestelle pro Woche bis zu 4 ✅ |
| Cron-Trigger             | 5 pro Account                       | 1–2 (Störungs-Check/Push) ✅                                                  |
| KV                       | 100.000 Reads, **1.000 Writes**/Tag | ungeeignet als Cache, nur für seltene Daten                                   |
| D1                       | 5 GB, 500 MB/DB                     | Push-Abos (M3) ✅                                                             |
| Durable Objects (SQLite) | 100.000 Req./Tag                    | Reserve, z. B. für Rate-Limit-Zähler                                          |
| Static Assets            | 20.000 Dateien, 25 MiB/Datei        | ✅                                                                            |

**Caching:** Die Cache API (`caches.default`) hält Abfahrten 30 s (Schlüssel auf die Minute gerundet), Haltestellensuchen 24 h, die VRR→Transitous-Zuordnung und die Linienfarben je Haltestelle 7 Tage. Die Cache API greift auch auf `*.workers.dev`. Getestet am 13.11.2026 in Produktion mit dem Diagnose-Endpunkt `/api/cache-probe`: erster Aufruf `miss`, danach `hit`. Eine eigene Domain ist dafür nicht nötig.

**Transitous `/plan`:** Ein Zähler im Worker sorgt dafür, dass wir unter 720 Anfragen/24 h bleiben. Darüber nutzen wir nur VRR bzw. sprechen uns vorher mit Transitous ab.

## Sicherheit in der App

- **Security-Header** im Worker:
  - strikte `Content-Security-Policy` (nur eigene Origin + OpenFreeMap; `worker-src 'self'` für Service Worker und MapLibre-Worker). Für die Karte erweitert (`public/_headers`): `connect-src https://tiles.openfreemap.org` (Stil, TileJSON, Vektor- und Rasterkacheln, Schriften, Sprites; MapLibre lädt alles per `fetch`) und `img-src blob:` (MapLibres Bild-Fallback in Browsern ohne `createImageBitmap`). Bewusst **ohne** `'unsafe-eval'`, ohne `blob:` für Worker und ohne Inline-Styles (MapLibre setzt Styles per CSSOM, das ist erlaubt). Geprüft im Browser: keine CSP-Verstöße.
  - `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (Geolocation nur self)
- **Eingabevalidierung** aller `/api`-Parameter, z. B. mit `zod`. Keine Weiterleitung beliebiger URLs, der Worker ist kein offener Proxy.
- **Rate-Limit** pro IP im Worker (60 Anfragen/Minute je Isolate, `worker/rate-limit.ts`), Pflicht laut VRR-§6.2
- **User-Agent** `Abfahrt/<version> (+Repo-URL)` bei allen Anfragen an die Quellen, Pflicht laut Transitous-Policy
- **Keine personenbezogenen Daten:** keine Accounts, kein Tracking, keine Logs mit Standortdaten

## Pflicht-Quellhinweise (Impressum/„Über“-Seite + Ergebnislisten)

- VRR: Logo/Link + _„Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne Gewähr.“_
- Transitous: Link auf https://transitous.org/sources/
- © OpenStreetMap contributors, OpenFreeMap
