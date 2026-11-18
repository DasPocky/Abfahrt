# Bedienung

So funktioniert Abfahrt im Alltag. Technische Details stehen in der [Architektur](02-architektur.md).

## Navigation

Unten stehen fünf Bereiche: **Abfahrten**, **Verbindung**, **Karte**, **Störungen** und **Mehr**.

- Jeder Bereich merkt sich, wo du warst, z. B. die offene Haltestelle oder die letzte Suche.
- Tippst du auf den Bereich, in dem du gerade bist, geht es an dessen Anfang.
- **Mehr** enthält Benachrichtigungen, die Anleitung zum Installieren, die Einstellungen und „Über Abfahrt“ mit Datenquellen
  und Datenschutz.
- Android: Lange auf das App-Symbol tippen öffnet direkt Abfahrten, Verbindung, Karte oder Störungen.

## Haltestelle suchen

- Auf der Startseite den Namen einer Haltestelle eingeben, ab 2 Zeichen erscheinen Vorschläge.
- Treffer antippen, oder per Tastatur: Pfeil runter/hoch wählt, Enter öffnet, Esc leert die Suche.
- Haltestellen tragen das grüne Haltestellen-Schild mit gelbem **H**, Adressen ein Haus, Orte ein Gebäude.
- **Zuletzt gesucht:** Das leere Suchfeld antippen zeigt die zuletzt geöffneten Haltestellen. Das ✕ daneben
  entfernt eine, **Mehr → Einstellungen → Verlauf löschen** alle. Gespeichert nur im Browser.
- **Standort:** Beim Öffnen fragt die App den Browser nach dem Standort. Mit Erlaubnis stehen Treffer in
  deiner Nähe oben (z. B. „Holthausen“ in Düsseldorf vor Essen), jeweils mit Entfernung.
  - Das 📍-Symbol im Suchfeld schaltet das an und aus. Ausgeschaltet fragt die App nicht mehr.
  - Lehnt man im Browser ab, fragt sie beim nächsten Öffnen wieder. Wird der Standort in den Einstellungen
    freigegeben, holt sie ihn sofort.
  - Für die Suche bleibt der Standort im Gerät.
  - Blockiert der Browser den Standort (am iPhone oft über die Ortungsdienste), zeigt die App „So gibst du
    ihn frei“ mit den Schritten für iPhone, Android und Computer.
- **In der Nähe:** Die Startseite zeigt die Haltestellen im Umkreis von 1 km, die nächste zuerst. Dafür geht
  der Standort auf etwa 100 m gerundet an den Worker.

## Abfahrten

- Die Abfahrtsseite (`/abfahrt/haltestelle/<id>`) lädt alle 30 Sekunden neu, der Countdown läuft dazwischen
  weiter. Der Link lässt sich als Lesezeichen speichern.
- **Zeiten:** Der Countdown („5 Min“, „jetzt“) zählt bis zur tatsächlichen Abfahrt. Direkt darunter steht die
  Verspätung als farbiges Kästchen (**+2** orange bis 4 Minuten, **+6** rot ab 5 Minuten, früher grün). In
  der Zeile unter dem Ziel steht zuerst die tatsächliche Uhrzeit in derselben Farbe, die Planzeit klein und
  durchgestrichen daneben („ab 12:17 ~~12:12~~“). Pünktliche Fahrten zeigen dezent „pünktlich“.
- Fahrtziele in der eigenen Stadt stehen ohne Ort („Benrath Btf“), in anderen Städten mit Ort
  („Düsseldorf Holthausen“).
- **Filtern:** Über der Liste stehen die Verkehrsmittel der Haltestelle (z. B. S-Bahn, U-Bahn, Bus).
  Antippen filtert, mehrere sind möglich. Das **Filter-Symbol** rechts bietet Linien, Gleis/Steig und
  „Abfahrten ab“ (Tag und Uhrzeit wie bei der Verbindungssuche). Der Filter steht in der Adresse, der Link
  lässt sich teilen.
- **Störungen** der Haltestelle stehen als schlanke Zeile über den Abfahrten. Defekte **Aufzüge und
  Rolltreppen** haben eine eigene Zeile.
- **Abfahrt antippen** öffnet den Fahrtverlauf (auch in den Favoriten).

## Fahrtverlauf

- Zeigt alle Halte der Fahrt vom Start bis zum Ziel mit Zeit, Verspätung und Gleis/Steig, als Linie in
  Linienfarbe.
- Die Haltestelle, von der du kommst, ist hervorgehoben; die Seite springt beim Öffnen dorthin.
- Oben steht kurz, wann die Fahrt bei dir ist („An Heinrich-Heine-Allee in 4 Min“), danach der nächste
  Halt bzw. „Fahrt beendet“.
- Bereits passierte Halte sind blasser. Das Fahrzeug-Symbol mit „jetzt“ zeigt auf der Linie, wo die Bahn
  bzw. der Bus gerade ist (nach Echtzeit, sonst nach Fahrplan).
- **Karte** klappt die Strecke auf. Einen Halt antippen öffnet dessen Abfahrten.
- Lädt alle 30 Sekunden neu. Auch ein Fahrzeug auf der Karte führt über **Verlauf** hierher.

## Favoriten

- Der **Stern** speichert die aktuelle Ansicht als Favoriten, inklusive Filter.
- Dieselbe Haltestelle kann mehrfach gespeichert werden, z. B. „Hbf · S-Bahn“ und „Hbf · U-Bahn“.
- Favoriten stehen auf der Startseite unter „Meine Haltestellen“ mit den nächsten Abfahrten.
- **Bearbeiten** benennt um, verschiebt und entfernt.
- Gespeichert wird nur im eigenen Browser.

## Verbindung suchen

Bereich **Verbindung** (`/abfahrt/verbindung`).

### Start und Ziel

- **Von** und **Nach** wie in der Suche eintippen: Haltestellen, Adressen (🏠, z. B. „Königsallee 1“) und
  Orte (🏛, z. B. „Rheinturm“), Treffer in deiner Nähe zuerst.
- **Haltestellen stehen immer oben**, darunter unter „Adressen und Orte“ höchstens drei Adressen bzw. Orte.
  Endet die Eingabe auf eine Hausnummer („Königsallee 1“), stehen die Adressen oben.
- Das leere Feld antippen zeigt „Mein Standort“, die zuletzt gewählten Orte und die Favoriten. Das gilt
  für Von, Nach und Zwischenhalte (dort nur Haltestellen).
- Bei Adressen und Orten beginnt bzw. endet die Verbindung mit einem Fußweg.
- „Mein Standort“ nimmt die nächste Haltestelle.
- Der runde Pfeil-Knopf tauscht Start und Ziel.

### Zwischenhalte

- **„+ Zwischenhalt“** unter dem Kasten fügt einen Halt zwischen Start und Ziel ein, bis zu 5.
- Jeder Zwischenhalt hat eine Haltestellensuche, einen **Aufenthalt** (kein Halt, 5–60 Min), Pfeile zum
  Verschieben und ein ✕ zum Entfernen. Tauschen dreht auch die Reihenfolge der Zwischenhalte um.
- **Ein Zwischenhalt:** Die Suche läuft in einer Abfrage, die Ergebnisse sind ganz normale Verbindungen über
  diesen Halt.
- **Mehrere Zwischenhalte:** Die App sucht in **Abschnitten** (Start → 1, 1 → 2, …), vorne mit blauer Nummer
  (①, ②, …), Zwischenhalte mit Fähnchen. Jeder Abschnitt beginnt nach der
  Ankunft des vorigen plus Aufenthalt. Oben steht die Gesamtroute mit Ab, An, Dauer und allen Halten,
  darunter jeder Abschnitt mit seiner Verbindung. **Andere Verbindung** wählt eine frühere oder spätere, die
  folgenden Abschnitte rechnen dann neu. Die Zeit gilt dabei immer als Abfahrt.
- Die Zwischenhalte stehen in der Adresse (`ueber`, `ueberName`, `aufenthalt` je Halt), der Link lässt sich
  teilen.

### Zeitpunkt

Der Chip **„Ab jetzt ▾“** öffnet:

- Abfahrt oder Ankunft
- den Tag per Antippen (Heute, Morgen, Wochentage, Kalender)
- die Uhrzeit mit −15/+15 Minuten
- die Schnellwahl „in 15 Min“, „in 30 Min“, „in 1 Std“

Der Chip zeigt dann z. B. „An morgen 08:15“, „Jetzt“ setzt zurück.

### Optionen

Das **Optionen-Symbol** öffnet alle Einstellungen, die der VRR anbietet:

- **Route:** schnellste, wenige Umstiege, wenig Fußweg
- **Verkehrsmittel** in Linienfarbe, abgewählte grau und durchgestrichen (für das Deutschlandticket den
  Fernzug abwählen)
- **Umstiege:** beliebig, direkt, max. 1 oder 2
- **Umstiegszeit:** kurz, normal, mehr Zeit
- **Barrierefreiheit:** Rollstuhl oder einzeln ohne Treppen, ohne Rolltreppen, Niederflur
- **Fahrrad mitnehmen** und **Haltestellen in der Nähe**

Aktive Optionen stehen kurz unter der Zeile. Routenwahl, Fahrrad und Umgebung wirken im VRR-Gebiet.

### Ergebnisse

- Jede Verbindung zeigt Ab → An, Dauer und Umstiege. Bei Verspätung steht die tatsächliche Zeit in Orange
  bzw. Rot, dahinter das Kästchen mit der Verspätung (**+3**). In den Details steht die tatsächliche Zeit
  oben, die Planzeit klein und durchgestrichen darunter.
- „ⓘ Hinweise“ ist grau: es gibt Hinweise, sie gefährden die Verbindung aber nicht. Ausfälle und gefährdete
  Anschlüsse bleiben rot bzw. gelb.
- Darunter ein **Balken** mit den Fahrten in Linienfarbe (Länge nach Fahrzeit, Fußwege gepunktet) und
  „ab 14:53 Gleis 2“ der ersten Fahrt (mit Fußweg davor: „4 Min, dann ab …“).
- Ausfälle sind rot markiert. Knappe Umstiege (unter 2 Minuten Puffer nach Echtzeit und Fußweg) heißen
  „Anschluss gefährdet“ (gelb) bzw. „Anschluss nicht erreichbar“ (rot).
- **Bequeme Varianten:** Gibt es zur selben Abfahrt eine Variante mit Umstieg am selben Steig oder weniger
  Fußweg, die höchstens 5 Minuten später ankommt, steht sie vorn („3 Min Umstieg · selber Steig“).
- **Orte:** Halte in einer anderen Stadt als dem Start stehen mit Ort („Holthausen, Düsseldorf“ auf dem Weg
  von Dortmund).
- **Früher**/**Später** blättern.
- Alle Angaben stehen in der Adresse (`?von=…&nach=…&zeit=…&route=wenig-fussweg…`), der Link lässt sich
  teilen.

### Details und Routenkarte

- Antippen klappt die Details als **Zeitleiste** auf: Zeiten links, eine Linie in Linienfarbe von Halt zu
  Halt, je Fahrt Linie, Richtung, Ab/An mit Verspätung und Gleis/Steig (Gleiswechsel in Orange).
- „N Zwischenhalte“ klappt die Halte auf. Fußwege stehen mit Dauer und Länge, vor jeder Anschlussfahrt die
  Umstiegszeit. Hinweise öffnen beim Antippen den vollen Text.
- Ausgefallene Fahrten und Halte sind rot bzw. durchgestrichen.
- **Karte** oben in den Details zeigt die Route: jede Fahrt in Linienfarbe, Fußwege grau gestrichelt, Start
  und Ziel als gefüllte Punkte, Umstiege als kleine Kreise.
  - Verschieben mit zwei Fingern (am Rechner Strg + Mausrad zum Zoomen), damit die Seite mit einem Finger
    weiter scrollt. Per Tastatur Tab auf die Karte, dann Pfeiltasten und +/−.
  - Fehlt der Streckenverlauf, verbindet die Karte die Halte.

## Live-Begleitung

- **„Merken & live verfolgen“** in den Details einer Verbindung öffnet `/abfahrt/fahrt`.
- Groß steht der nächste Schritt: „U76 ab Holthausen · Gleis 2 – Abfahrt in 5 Min“, unterwegs „Ankunft in
  12 Min“, beim Umstieg „Umsteigen: S6 ab … in 6 Min“. Darunter die Zeitleiste.
- Die Seite fragt alle 30 Sekunden neu ab und erkennt die Verbindung an Linien und Planzeiten wieder.
- Bei gefährdetem Anschluss, Ausfall oder wenn die Verbindung nicht mehr im Fahrplan ist, erscheint eine
  Warnung mit **Alternativen suchen** (ab dem nächsten Einstieg).
- Die Startseite zeigt die Fahrt oben, bis 30 Minuten nach der Ankunft. **Begleitung beenden** löscht sie.
- Gespeichert wird nur im Browser (`abfahrt:trip`).

## Karte

Bereich **Karte** (`/abfahrt/karte`).

- **Haltestellen** erscheinen ab Straßenzoom, ab Zoomstufe 16 mit Namen. Weiter herausgezoomt bittet die
  Karte ums Heranzoomen.
- **Steige:** Jeder Steig ist ein eigener Punkt an seiner echten Position. Nur Steige, die bei der aktuellen
  Zoomstufe auf dem Bildschirm zusammenfallen würden, werden ein gemeinsamer Punkt (antippen öffnet dann die
  ganze Haltestelle).
- Der Punkt ist ein Kreis mit einem Segment je Verkehrsmittel (z. B. halb blau, halb rot für U-Bahn +
  Straßenbahn), herangezoomt mit Steig-Nummer. Antippen zeigt Haltestelle und Steig, **Abfahrten** öffnet
  die Abfahrten nur dieses Steigs.
- **Live-Fahrzeuge:** Busse und Bahnen bewegen sich auf der Karte (Kreis in Linienfarbe mit Liniennummer).
  Die Position ist aus Fahrplan und Echtzeit geschätzt, ohne Echtzeit erscheint der Punkt blasser. Antippen
  zeigt Linie, nächsten Halt und Verspätung, **Verlauf** öffnet den Fahrtverlauf. Das Straßenbahn-Symbol
  oben links blendet die Fahrzeuge aus.
- Die Karte startet am Standort, wenn er in der App schon erlaubt ist (sonst Düsseldorf Innenstadt). Das
  Fadenkreuz oben links springt dorthin.
- An unseren Server geht nur der sichtbare Ausschnitt, nicht der Standort.

## Störungen

Bereich **Störungen** (`/abfahrt/stoerungen`).

- Sperrungen, Aufzüge/Rolltreppen und Infos des VRR für eine Gemeinde, Sperrungen zuerst.
- Die Gemeinde ergibt sich aus der ersten Favoriten-Haltestelle, sonst aus der nächsten Haltestelle
  (Standort), sonst Düsseldorf. Über das Suchfeld lässt sich eine andere Haltestelle (und damit Gemeinde)
  wählen.
- Jede Zeile zeigt Art (Symbol), Titel, betroffene Linien und Gültigkeit („bis 21.11.“, „seit 10.10.“,
  „ab 30.11.“). Meldungen zu deinen Favoriten stehen oben und tragen einen ★.
- Die Chips filtern nach Verkehrsmittel. Antippen öffnet den vollen Text mit Link zur Quelle.
- Bei Störungen an deinen Favoriten (Haltestelle oder eine Linie aus dem Favoriten-Filter) zeigt die
  Startseite über „Meine Haltestellen“ einen Hinweis, z. B. „2 Störungen bei deinen Favoriten“.
- Meldungen gibt es nur für Haltestellen im VRR.

## Benachrichtigungen

- Im Bereich [Mehr](https://endlab.de/abfahrt/mehr) einschalten und mit einer **Testnachricht**
  prüfen. Am iPhone geht das nur, wenn Abfahrt auf dem Home-Bildschirm installiert ist.
- Darunter wählst du, wofür Nachrichten kommen:
  - **Störungen bei Favoriten:** neue Meldungen zu deinen Haltestellen und den Linien aus deren Filtern
  - **Gemerkte Fahrt:** ab 60 Minuten vor der Abfahrt bei Verspätung ab 5 Minuten, gefährdetem Anschluss,
    Ausfall oder wenn die Verbindung nicht mehr im Fahrplan ist
  - **Ruhe 22–6 Uhr:** dann keine Störungsmeldungen
- Geprüft wird alle 5 Minuten. Gemeldet wird nur, was neu ist.

## Einstellungen

Unter **Mehr → Einstellungen** (`/abfahrt/einstellungen`), gespeichert nur im Browser:

- **Darstellung der Abfahrten** mit Vorschau: **Linie vorn** (Standard: Linie mit Symbol, Ziel, Minuten
  rechts), **Anzeigetafel** (große Minuten vorn, Gleis rechts) oder **Karten** (jede Abfahrt als Karte mit
  Farbstreifen der Linie). Gilt für Haltestellen und Favoriten.
- **Erscheinungsbild:** wie System, Hell oder Dunkel. Gilt auch für die Karte.
- **Abfahrten je Favorit** auf der Startseite: 3, 4, 6 oder 8.
- **Suchverlauf:** Anzahl der gemerkten Orte, **Verlauf löschen** entfernt alle.

## Vorlesen

- Das **Lautsprecher-Symbol** liest vor: auf der Haltestellenseite die nächsten 5 Abfahrten, bei jedem
  Favoriten dessen Abfahrten, im Fahrtverlauf, wann die Fahrt bei dir ist, und in den Details einer
  Verbindung (**Vorlesen**) Abfahrt, Ankunft, Umstiege und jeden Abschnitt.
- Beispiel: „U 76 nach Holthausen, in 4 Minuten, 13 Minuten später, Steig 4.“ Gleiswechsel („heute Gleis 9
  statt 10“) und Ausfälle werden genannt.
- Erneut tippen stoppt. Das Tempo (langsam, normal, schnell) steht in den Einstellungen.
- Es spricht die Sprachausgabe deines Geräts, dabei verlässt nichts dein Gerät. Kann der Browser nicht
  vorlesen, fehlt das Symbol.

## Installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“. Nur so gibt es Benachrichtigungen.
- **Android (Chrome):** Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- Die App startet dann im Vollbild und funktioniert offline mit dem zuletzt geladenen Stand.
