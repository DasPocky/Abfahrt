# Datenquellen

Stand: 30.10.2026. Alle Quellen wurden an diesem Tag live angetestet, die Testanfragen stehen unten bei der jeweiligen Quelle.

## Übersicht & Entscheidung

| Quelle                               | Abdeckung                                        | Echtzeit                            | Funktionen                                                                | Zugang                                          | Rolle bei uns                   |
| ------------------------------------ | ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| **VRR OpenService (EFA)**            | VRR (Rheinbahn u. a.), Fernverkehr durch den VRR | ✅ sekundengenau                    | Abfahrten, Verbindungen, Haltestellensuche, Störungen, Hinweise pro Fahrt | ohne Key (Test/Hobby), Produktivzugang per Mail | **Primärquelle Rheinland**      |
| **Transitous (MOTIS 2)**             | ganz Deutschland + Europa                        | ✅ minutengenau, wo Feeds vorhanden | Abfahrten, Verbindungen, Geocoding, Fahrten, Linienfarben                 | ohne Key, nur Open Source & nicht kommerziell   | **Deutschland-weit + Fallback** |
| VRR MIP                              | VRR                                              | ✅                                  | Aufzüge/Rolltreppen, P&R, Radboxen, Bikesharing                           | öffentlicher Key, CC BY 4.0                     | M3/M4 (Aufzugsstörungen)        |
| OpenFreeMap                          | weltweit                                         | –                                   | Vektor-Kartenkacheln (OSM)                                                | ohne Key                                        | **Karte**                       |
| DB API Marketplace (RIS::Transports) | DB-Züge                                          | ✅                                  | Wagenreihung                                                              | Registrierung nötig                             | M4 (Wagenreihung)               |
| gtfs.de GTFS-RT                      | Deutschland                                      | ✅                                  | Roh-Feed TripUpdates/Alerts                                               | frei, CC BY-SA 4.0                              | ❌ nicht nutzbar (s. u.)        |
| v6.db.transport.rest                 | Deutschland (DB)                                 | ✅                                  | Abfahrten, Verbindungen                                                   | frei                                            | ❌ Dienst down (503)            |

**Strategie:** Ein Adapter-Muster im Worker. Jede Quelle liefert in ein gemeinsames internes Format. Haltestellen im VRR-Gebiet fragen wir bei VRR ab, sonst bei Transitous. Fällt VRR aus, springt Transitous ein.

## VRR OpenService (EFA)

- **Doku:** https://www.opendata-oepnv.de/ht/de/api (EFA-JSON-Doku, JSON-Schema, TRIAS)
- **Basis-URL:** `https://openservice.vrr.de/openservice/` mit `outputFormat=rapidJSON&version=10.4.18.18` (empfohlen)
- **Endpunkte:**
  - `XML_STOPFINDER_REQUEST`: Haltestellen-/Adresssuche
  - `XML_DM_REQUEST`: Abfahrtsmonitor (`type_dm=stop&name_dm=<ID>&mode=direct&useRealtime=1`)
  - `XML_TRIP_REQUEST2`: Verbindungssuche
  - `XML_ADDINFO_REQUEST`: Störungsmeldungen
  - `XML_COORD_REQUEST`: Haltestellen in der Nähe
- **CORS:** ❌ kein `Access-Control-Allow-Origin`, deshalb **Worker-Proxy zwingend**

**Test 30.10.2026**, Düsseldorf Heinrich-Heine-Allee (`de:05111:18036`):

- 8/8 Abfahrten mit Echtzeit (`isRealtimeControlled`), Zeiten sekundengenau (z. B. U79 plan 18:56 → 19:04:36)
- Steig, Produkt (U-Bahn/Bus) und Hinweise (`infos`) pro Abfahrt
- `XML_ADDINFO_REQUEST`: 1.173 aktuelle Meldungen inklusive betroffener Linien
- `XML_TRIP_REQUEST2` Heinrich-Heine-Allee → Köln Hbf: 3 Verbindungen mit Echtzeit

**Besonderheiten:**

- Die Ergebnisse sind nach **Planzeit** sortiert. Stark verspätete Fahrten erscheinen deshalb oben, wir sortieren nach Echtzeit neu.
- Linienfarben liefert die EFA nicht. Wir pflegen sie als statische Tabelle bzw. übernehmen sie aus Transitous (`routeColor`).

### Nutzungsvereinbarung API (v1.0, 16.04.2018), Kernpunkte

Quelle: https://www.opendata-oepnv.de/ht/de/standards/nutzungsvereinbarung-api

- **§3.1:** Nur **Live-Abfragen** auf Anfrage des Endnutzers. Systematische Abrufe bzw. Serienabfragen sind verboten. Unser Worker fragt deshalb nur bei echtem Nutzerbedarf ab, mit kurzem Cache (≤ 30 s) zur Entlastung und ohne Vorab-Crawling.
- **§3.2:** API-Keys dürfen nicht an Endnutzer gelangen. Keys liegen deshalb nur als Worker-Secret vor.
- **§4.3 Quellhinweis Pflicht:** Logo und/oder Link in lesbarer Größe, dazu der Text _„Fahrplanauskünfte werden durch den Lizenzgeber zur Verfügung gestellt. Alle Angaben ohne Gewähr.“_
- **§5:** Die Nutzung ist kostenfrei.
- **§6:** Der VRR kann Limits festlegen. Wir müssen Massenabrufe technisch verhindern, deshalb Rate-Limit im Worker.
- **Zugang:** Der OpenService ist ohne Registrierung nutzbar für _„Forschung-, Test-, Entwicklungs- oder Hobbyzwecke“_. Wird die App öffentlich angeboten, ist der **Produktivserver** Pflicht, beantragt per Mail an `opendata-oepnv@vrr.de`. Der OpenService ist ausdrücklich auch eine Testumgebung des VRR, _„so dass es zeitweise nicht zu plausiblen Ergebnissen kommen kann“_.

**Andere Verbünde in NRW** (für später, jeweils mit eigenem Key):

- VRS (Köln/Bonn): https://www.vrs.de/fahren/fahrplanauskunft/opendata-/-openservice
- AVV (Aachen): https://avv.de/de/fahrplaene/angebote-fuer-webentwickler

## Transitous (MOTIS 2)

- **Doku/Policy:** https://transitous.org/api/
- **Basis-URL:** `https://api.transitous.org/api/` (Staging und interne Endpunkte dürfen **nicht** genutzt werden)
- **Endpunkte:**
  - `v1/geocode`: Suche
  - `v1/stoptimes`: Abfahrten
  - `v5/plan`: Verbindungen
  - `trip`: Fahrtverlauf
  - `map/trips`: Fahrzeugpositionen
- **CORS:** ✅ `Access-Control-Allow-Origin: *`

**Test 30.10.2026:**

- Düsseldorf Hbf: Abfahrten mit Echtzeit, Gleis, **Linienfarbe** (`routeColor`) und Betreiber (S8, U75, 709, 732 …)
- Heinrich-Heine-Allee: 8/11 Abfahrten mit Echtzeit
- `plan` Düsseldorf → Köln: 5 Verbindungen mit Fußwegen

**Nutzungsbedingungen**, alle Punkte müssen zutreffen:

1. **Projekt ist Open Source.** Der Quellcode muss unter einer Open-Source-Lizenz veröffentlicht sein. Leichte Prototyp-Tests vorher sind ok. ✅ Erfüllt: Das Repo ist seit 31.10.2026 öffentlich (AGPL-3.0).
2. **Nicht kommerziell.**
3. **Ressourcenschonend:** Mehr als 720 Anfragen/24 h vom Typ `/plan`, viele Nutzer oder automatisierte Abfragen erfordern vorherige Abstimmung im Matrix-Kanal.
4. **User-Agent** bei jeder Anfrage mit App-Name, Version und Kontakt (E-Mail oder URL)
5. **Quellhinweis:** sichtbarer Link auf https://transitous.org/sources/ plus OSM-Attribution
6. Betrieb erfolgt best effort. Transitous kann den Zugang jederzeit beenden.

Wir rufen Transitous deshalb ebenfalls nur über den Worker auf: wegen User-Agent, Cache und Zählung der `/plan`-Anfragen.

## OpenFreeMap (Karte)

- Kostenlose Vektorkacheln auf OSM-Basis, ohne Key: `https://tiles.openfreemap.org/styles/liberty` (getestet ✅)
- Darstellung mit **MapLibre GL JS**
- Pflicht: OSM-Attribution („© OpenStreetMap contributors“)

## VRR Mobilitäts- und Infrastruktur-Plattform (MIP)

- Aufzüge/Fahrtreppen (`/vrr-api/rest/stop/all/infrastructure`), P&R, B&R, Bikesharing
- Lizenz CC BY 4.0. Der API-Key ist öffentlich auf der Doku-Seite angegeben, wir behandeln ihn trotzdem als Worker-Secret.
- Nutzung ab M3 (Aufzugsstörungen bei der Haltestelle)

## DB API Marketplace

- https://developers.deutschebahn.com/db-api-marketplace/apis/
- **RIS::Transports** liefert die Wagenreihung, wagengenaue Position am Gleis und Ausstattung
- Erfordert eine **Registrierung**, die nur du durchführen kannst. Das wird erst in M4 relevant.

## Verworfen

- **v6.db.transport.rest / db-vendo-client:** Der öffentliche Dienst antwortet am 30.10.2026 mit `503`. Laut README sind die DB-APIs _„subject to haphazard blocking and have become very unreliable“_, die Bibliothek empfiehlt selbst Transitous. Strikt genommen bräuchte man außerdem eine Erlaubnis der DB.
- **gtfs.de GTFS-RT** (`realtime-free.pb`): Der Feed ist ein Komplett-Dump für ganz Deutschland (≈ 21 MB, alle 10 s). Verarbeiten lässt er sich nur mit passendem statischem GTFS (Hunderte MB). Das passt nicht in die Free-Limits (10 ms CPU, 128 MB RAM). Transitous verarbeitet genau diese Daten bereits für uns.
