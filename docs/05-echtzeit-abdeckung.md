# Echtzeit-Abdeckung in Deutschland

Wie viele Abfahrten haben über unsere bundesweite Quelle Transitous Echtzeit (#104)? Grundlage für die Wahl
zusätzlicher regionaler Quellen, wie heute schon der VRR im Rheinland.

## Methode

- Stichtag: Dienstag, 17.11.2026, ca. 13 Uhr (werktags, mittags)
- 61 Haltestellen in allen 16 Ländern: Großstädte, Mittelstädte und kleine Orte
- Transitous `v1/geocode` (Haltestelle) und `v5/stoptimes` (bis 150 Abfahrten), gezählt nur die Abfahrten
  der nächsten 45 Minuten (für spätere Fahrten gibt es oft noch keine Echtzeit)
- „Echtzeit“ = `realTime: true` bei der Abfahrt
- Eine Momentaufnahme: Zu anderen Zeiten kann es anders aussehen. Das Skript liegt nicht im Repo, die Werte
  lassen sich mit denselben Abfragen jederzeit wiederholen.

## Ergebnis

Nach Verkehrsmittel: S-Bahn 83 % (211/253), Fern 82 % (43/52), Regio 76 % (188/246), Tram 59 % (678/1139), U-Bahn 51 % (236/460), Bus 38 % (882/2287).

Nach Ortsgröße: groß 59 %, mittel 47 %, klein 34 %.

**Züge** (S-Bahn, Regio, Fernverkehr) haben meist Echtzeit. Die **Lücken liegen bei Bussen, Straßen- und
U-Bahnen**, und zwar regional sehr unterschiedlich, nicht nur auf dem Land:

- **Gut (≥ 80 %):** Stuttgart, Karlsruhe, Freiburg, Mannheim, Augsburg, Regensburg, München U-Bahn,
  Dresden, Leipzig, Halle, Erfurt, Potsdam, Köln, Görlitz
- **Lücken:** Niedersachsen und Bremen fast ohne Echtzeit bei Bus und Tram (Hannover-Busse, Braunschweig,
  Osnabrück, Oldenburg, Göttingen, Lingen, Cuxhaven, Bremen), Hamburg (U-Bahn, Bus), Hessen (Frankfurter
  U-Bahn, Darmstadt, Kassel), Mecklenburg-Vorpommern, Mainz, Nürnberg (Tram, U-Bahn), Münster, Bielefeld,
  Teile von Berlin
- **Düsseldorf** über Transitous nur 31 % – dort nutzen wir den VRR direkt, der deutlich mehr hat

## Einzelwerte

| Land | Haltestelle                     | Größe  | Echtzeit | Anteil | je Verkehrsmittel                                           |
| ---- | ------------------------------- | ------ | -------- | ------ | ----------------------------------------------------------- |
| BW   | Stuttgart Hbf                   | groß   | 135/142  | 95 %   | Bus 30/30, Fern 4/4, Regio 7/10, S-Bahn 35/39, U-Bahn 59/59 |
| BW   | Mannheim, Paradeplatz           | groß   | 50/57    | 87 %   | Tram 50/57                                                  |
| BW   | KA Marktplatz (Kaiserstraße U)  | groß   | 38/38    | 100 %  | Regio 28/28, Tram 10/10                                     |
| BW   | Freiburg, Bertoldsbrunnen       | mittel | 48/48    | 100 %  | Tram 48/48                                                  |
| BW   | Ulm, Hauptbahnhof               | mittel | 72/89    | 80 %   | Bus 38/51, Fern 6/8, Regio 9/11, Tram 19/19                 |
| BW   | Biberach (Riss), Bahnhof/ZOB    | klein  | 37/52    | 71 %   | Bus 31/46, Regio 6/6                                        |
| BY   | Marienplatz                     | groß   | 57/71    | 80 %   | Bus 0/5, S-Bahn 28/37, U-Bahn 29/29                         |
| BY   | Nürnberg Hauptbahnhof           | groß   | 30/135   | 22 %   | Fern 3/4, Regio 7/13, S-Bahn 13/15, Tram 2/75, U-Bahn 5/28  |
| BY   | Augsburg, Königsplatz           | groß   | 95/102   | 93 %   | Bus 13/17, Tram 82/85                                       |
| BY   | Regensburg Hbf                  | mittel | 117/133  | 87 %   | Bus 112/126, Regio 5/7                                      |
| BY   | Würzburg Hbf                    | mittel | 70/90    | 77 %   | Bus 42/53, Fern 4/4, Regio 5/8, Tram 19/25                  |
| BY   | Cham, Bahnhof                   | klein  | 16/20    | 80 %   | Bus 10/14, S-Bahn 6/6                                       |
| BY   | Passau Hbf                      | klein  | 11/32    | 34 %   | Bus 11/31, Regio 0/1                                        |
| BE   | S+U Alexanderplatz Bhf (Berlin) | groß   | 66/85    | 77 %   | S-Bahn 31/31, U-Bahn 35/54                                  |
| BE   | S+U Rathaus Spandau (Berlin)    | groß   | 64/137   | 46 %   | Bus 62/127, U-Bahn 2/10                                     |
| BB   | S Potsdam Hauptbahnhof          | mittel | 64/69    | 92 %   | Bus 29/32, Regio 8/8, S-Bahn 5/5, Tram 22/24                |
| BB   | Cottbus, Hauptbahnhof           | mittel | 16/48    | 33 %   | Bus 9/16, Regio 7/7, Tram 0/25                              |
| BB   | Prenzlau, Bahnhof               | klein  | 2/2      | 100 %  | Regio 2/2                                                   |
| HB   | Bremen Hbf                      | groß   | 15/129   | 11 %   | Bus 0/56, Fern 1/2, Regio 6/6, S-Bahn 8/8, Tram 0/57        |
| HH   | Jungfernstieg                   | groß   | 17/141   | 12 %   | Bus 0/62, S-Bahn 17/34, U-Bahn 0/45                         |
| HH   | Hamburg-Altona                  | groß   | 2/4      | 50 %   | Fern 0/2, Regio 2/2                                         |
| HE   | Frankfurt (Main) Hauptwache     | groß   | 31/84    | 36 %   | S-Bahn 31/34, U-Bahn 0/50                                   |
| HE   | Kassel Königsplatz              | mittel | 8/45     | 17 %   | S-Bahn 7/7, Tram 1/38                                       |
| HE   | Darmstadt Luisenplatz           | mittel | 0/105    | 0 %    | Bus 0/60, Tram 0/45                                         |
| HE   | Fulda Bahnhof                   | klein  | 12/12    | 100 %  | Fern 7/7, Regio 5/5                                         |
| MV   | Rostock, Hauptbahnhof           | mittel | 11/52    | 21 %   | Bus 0/17, Fern 3/3, Regio 3/3, S-Bahn 5/7, Tram 0/22        |
| MV   | Schwerin Marienplatz            | mittel | 2/30     | 6 %    | Bus 2/14, Tram 0/16                                         |
| MV   | Stralsund Hauptbahnhof          | klein  | 1/31     | 3 %    | Bus 0/26, Regio 1/5                                         |
| NI   | Hannover Kröpcke                | groß   | 77/116   | 66 %   | Bus 0/14, U-Bahn 77/102                                     |
| NI   | Braunschweig, Rathaus           | mittel | 0/77     | 0 %    | Bus 0/39, Tram 0/38                                         |
| NI   | Osnabrück Neumarkt              | mittel | 0/113    | 0 %    | Bus 0/113                                                   |
| NI   | Oldenburg(Oldb) Lappan          | mittel | 0/136    | 0 %    | Bus 0/136                                                   |
| NI   | Göttingen Bahnhof/ZOB           | klein  | 0/44     | 0 %    | Bus 0/44                                                    |
| NI   | Lingen Bahnhof/ZOB              | klein  | 1/21     | 4 %    | Bus 0/20, Regio 1/1                                         |
| NI   | Meppen Bahnhof                  | klein  | 2/16     | 12 %   | Bus 0/14, Fern 1/1, Regio 1/1                               |
| NI   | Cuxhaven Bahnhof/ZOB            | klein  | 0/10     | 0 %    | Bus 0/10                                                    |
| NW   | Köln Neumarkt                   | groß   | 64/77    | 83 %   | Bus 8/9, Tram 56/68                                         |
| NW   | D-Heinrich-Heine-Allee U        | groß   | 31/99    | 31 %   | Bus 2/16, U-Bahn 29/83                                      |
| NW   | Bonn Hbf                        | mittel | 125/157  | 79 %   | Bus 80/101, Fern 2/2, Regio 5/5, S-Bahn 1/2, Tram 37/47     |
| NW   | Münster Hauptbahnhof            | mittel | 14/113   | 12 %   | Bus 0/91, Fern 5/5, Regio 9/17                              |
| NW   | Bielefeld, Jahnplatz            | mittel | 2/91     | 2 %    | Bus 2/51, Tram 0/40                                         |
| NW   | Aachen, Bushof                  | mittel | 87/139   | 62 %   | Bus 87/137                                                  |
| NW   | Siegen Hbf                      | klein  | 12/48    | 25 %   | Bus 7/41, Regio 5/6                                         |
| NW   | Paderborn Hbf                   | klein  | 17/72    | 23 %   | Bus 12/64, Regio 5/6, S-Bahn 0/1                            |
| RP   | Mainz, Hauptbahnhof             | mittel | 9/152    | 5 %    | Bus 1/105, Fern 2/2, Regio 2/8, S-Bahn 4/4, Tram 0/33       |
| RP   | Koblenz Hbf                     | mittel | 36/75    | 48 %   | Bus 29/66, Fern 1/2, Regio 6/7                              |
| RP   | Trier, Hauptbahnhof             | klein  | 27/46    | 58 %   | Bus 18/34, Regio 9/12                                       |
| RP   | Kaiserslautern, Hbf             | klein  | 15/47    | 31 %   | Bus 9/38, Regio 4/7, S-Bahn 2/2                             |
| SL   | Saarbrücken Hbf                 | mittel | 28/54    | 51 %   | Bus 19/34, Regio 4/9, Tram 5/11                             |
| SN   | Dresden Postplatz               | groß   | 85/85    | 100 %  | Bus 10/10, Tram 75/75                                       |
| SN   | Leipzig Hbf                     | groß   | 126/141  | 89 %   | Bus 2/12, Fern 3/3, Regio 5/6, S-Bahn 16/19, Tram 100/101   |
| SN   | Chemnitz, Zentralhaltestelle    | mittel | 77/105   | 73 %   | Bus 42/53, Regio 8/8, Tram 27/44                            |
| SN   | Görlitz Bahnhof                 | klein  | 16/17    | 94 %   | Bus 3/4, Regio 3/3, Tram 10/10                              |
| ST   | Magdeburg, Hauptbahnhof         | mittel | 25/34    | 73 %   | Bus 1/4, Fern 0/2, Regio 7/11, S-Bahn 2/2, Tram 15/15       |
| ST   | Halle (Saale), Marktplatz       | mittel | 47/53    | 88 %   | Tram 47/53                                                  |
| SH   | Kiel Hbf                        | mittel | 86/109   | 78 %   | Bus 80/101, Regio 6/8                                       |
| SH   | Lübeck Hbf/ZOB                  | mittel | 73/97    | 75 %   | Bus 70/92, Regio 3/5                                        |
| SH   | Flensburg ZOB                   | klein  | 11/51    | 21 %   | Bus 11/51                                                   |
| TH   | Erfurt, Anger                   | mittel | 50/54    | 92 %   | Tram 50/54                                                  |
| TH   | Jena Paradies                   | mittel | 5/5      | 100 %  | Fern 1/1, Regio 4/4                                         |
| TH   | Nordhausen, Bahnhofsplatz       | klein  | 3/4      | 75 %   | Tram 3/4                                                    |

## Mögliche Quellen für die Lücken (noch zu prüfen)

| Region                         | Quelle                          | Art           | Zugang                    |
| ------------------------------ | ------------------------------- | ------------- | ------------------------- |
| Bayern (München)               | MVV                             | EFA (wie VRR) | offen                     |
| Bayern (Nürnberg)              | VGN                             | EFA (wie VRR) | offen                     |
| Baden-Württemberg              | NVBW (efa-bw), VVS              | EFA (wie VRR) | offen                     |
| Westfalen (Münster, Bielefeld) | Westfalenfahrplan               | EFA (wie VRR) | offen                     |
| Hessen, Mainz                  | RMV                             | HAFAS ReST    | Schlüssel (kostenlos)     |
| Niedersachsen, Bremen          | VBN, GVH                        | HAFAS         | prüfen                    |
| Hamburg                        | HVV Geofox (GTI)                | eigene API    | Zugang auf Anfrage        |
| Berlin, Brandenburg            | VBB/BVG                         | HAFAS         | prüfen                    |
| Mecklenburg-Vorpommern         | VMV                             | HAFAS         | prüfen                    |
| Züge bundesweit                | DB Timetables (API Marketplace) | REST          | Registrierung (kostenlos) |

Wo ein Verkehrsunternehmen gar keine Echtzeit erfasst (häufig Busse auf dem Land), kann keine Quelle sie
liefern; die App zeigt dann „nach Fahrplan“.
