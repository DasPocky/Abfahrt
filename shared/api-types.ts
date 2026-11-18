// Vertrag zwischen Worker-API und App. Quellenunabhängig (VRR, Transitous).

export type TransportMode =
  "tram" | "subway" | "bus" | "suburban" | "regional" | "longdistance" | "ferry" | "other";

/** Quelle einer Antwort; „efa-bw“ = landesweite Auskunft Baden-Württemberg (NVBW, #104) */
export type DataSource = "vrr" | "transitous" | "efa-bw";

export const DATA_SOURCES: readonly DataSource[] = ["vrr", "transitous", "efa-bw"];

/** Art eines Suchtreffers: Haltestelle, Adresse (Straße/Hausnummer) oder Ort (POI) */
export type PlaceKind = "stop" | "address" | "poi";

export interface Stop {
  /**
   * Quellen-präfixierte ID, z. B. "vrr:de:05111:18036" oder "transitous:…";
   * Adressen und POIs: "geo:<lat>,<lon>" (siehe shared/geo-id.ts)
   */
  id: string;
  name: string;
  /** Ort, z. B. "Düsseldorf" */
  place?: string;
  lat?: number;
  lon?: number;
  /** Nur Suche: Passgenauigkeit 0–1000 (höher = besser), für das Ranking nach Nähe in der App */
  relevance?: number;
  /** Fehlt bei Haltestellen; nur die Suche mit `places=1` liefert Adressen und POIs */
  kind?: PlaceKind;
  /** Nur Karte (`stops/area`): Steige bzw. Bahnsteige an ihrer echten Position */
  platforms?: StopPlatform[];
}

/** Ein Steig/Bahnsteig einer Haltestelle (Karte) */
export interface StopPlatform {
  /** Steig- bzw. Gleisnummer, z. B. "1"; null wenn unbekannt */
  track: string | null;
  lat: number;
  lon: number;
  /** Verkehrsmittel, die hier halten */
  modes: TransportMode[];
}

export interface Departure {
  /** Stabil innerhalb einer Antwort, für React-Keys */
  id: string;
  /** Linienbezeichnung, z. B. "U79", "RE 5", "732" */
  line: string;
  mode: TransportMode;
  /** Ziel/Richtung */
  direction: string;
  /** ISO-8601 */
  plannedTime: string;
  /** ISO-8601, null wenn keine Echtzeit */
  realtimeTime: string | null;
  /** Gleis/Steig laut Echtzeit bzw. Plan */
  platform: string | null;
  /** Geplantes Gleis, falls abweichend (Gleiswechsel) */
  plannedPlatform: string | null;
  cancelled: boolean;
  /** Linienfarbe als Hex ohne "#", z. B. "008fc2" */
  lineColor: string | null;
  lineTextColor: string | null;
  /** Kurze Hinweise/Störungstexte zu dieser Fahrt */
  notices: string[];
  /** Verweis auf den Fahrtverlauf (`/api/trip?ref=…`, #120); fehlt, wenn die Quelle keinen hat */
  tripRef?: string;
}

export interface StopSearchResponse {
  stops: Stop[];
}

export interface DeparturesResponse {
  stop: Stop;
  departures: Departure[];
  source: DataSource;
  /** ISO-8601, Zeitpunkt der Datenabfrage */
  generatedAt: string;
}

// ---- Verbindungssuche (M2) ----

/** Halt innerhalb einer Verbindung (Start, Ziel, Umstieg oder Zwischenhalt) */
export interface JourneyStop {
  /** Haltestellen-ID wie in `Stop.id`, null bei Adressen/Koordinaten */
  id: string | null;
  name: string;
  place?: string;
  lat?: number;
  lon?: number;
  /** ISO-8601; null am Start (Ankunft) bzw. am Ziel (Abfahrt) */
  plannedArrival: string | null;
  realtimeArrival: string | null;
  plannedDeparture: string | null;
  realtimeDeparture: string | null;
  /** Gleis/Steig laut Echtzeit bzw. Plan */
  platform: string | null;
  /** Geplantes Gleis, falls abweichend (Gleiswechsel) */
  plannedPlatform: string | null;
  /** Halt fällt aus */
  cancelled: boolean;
}

export type JourneyLegKind = "transit" | "walk";

export interface JourneyLeg {
  kind: JourneyLegKind;
  origin: JourneyStop;
  destination: JourneyStop;
  /** Dauer laut Plan in Minuten */
  durationMinutes: number;
  /** Nur Fußwege: Länge in Metern, falls bekannt */
  distanceMeters: number | null;
  /** Nur Fahrten (bei Fußwegen null bzw. leer) */
  line: string | null;
  mode: TransportMode | null;
  direction: string | null;
  lineColor: string | null;
  lineTextColor: string | null;
  /** Zwischenhalte ohne Start und Ziel des Abschnitts */
  intermediateStops: JourneyStop[];
  /** Fahrt fällt (teilweise) aus */
  cancelled: boolean;
  notices: string[];
  /**
   * Streckenverlauf als `[lat, lon]`, gerundet auf 5 Nachkommastellen und auf höchstens ca.
   * 200 Punkte ausgedünnt. Ohne Geometrie der Quelle die Halte verbunden, null wenn unbekannt.
   */
  path: [number, number][] | null;
}

export interface Journey {
  /** Stabil innerhalb einer Antwort, z. B. für React-Keys */
  id: string;
  legs: JourneyLeg[];
  /** Anzahl Umstiege (Fahrten − 1, Fußwege zählen nicht) */
  transfers: number;
  /** Gesamtdauer laut Plan in Minuten */
  durationMinutes: number;
}

export interface JourneysResponse {
  from: Stop;
  to: Stop;
  journeys: Journey[];
  source: DataSource;
  /** ISO-8601, Zeitpunkt der Datenabfrage */
  generatedAt: string;
  /** Für „Früher“/„Später“: Zeitpunkt (ISO) für die nächste Abfrage mit `arrive=0` */
  earlier: string | null;
  later: string | null;
}

// ---- Störungen (M3) ----

/** blocking: Sperrung/Ausfall, facility: Aufzug/Rolltreppe, info: sonstige Hinweise (z. B. Bauarbeiten) */
export type AlertKind = "blocking" | "facility" | "info";
export type AlertSeverity = "high" | "normal" | "low";

export interface AlertLine {
  /** Linienbezeichnung wie in den Abfahrten, z. B. "U79", "706", "RE1" */
  line: string;
  mode: TransportMode;
}

export interface Alert {
  /** Stabil über Abrufe hinweg (Quelle + ID + Version), z. B. für „schon gesehen“ und Push */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  /** Kurzfassung, z. B. "Barrierefreier Ausbau der Haltestelle Flingern S, Steig 3" */
  title: string;
  /** Langtext ohne HTML, leer wenn nichts über den Titel hinaus */
  text: string;
  url: string | null;
  /** ISO-8601, Gültigkeit; null = unbekannt bzw. offen */
  validFrom: string | null;
  validTo: string | null;
  lines: AlertLine[];
  /** Betroffene Haltestellen (IDs wie in `Stop.id`) */
  stops: { id: string; name: string }[];
}

export interface AlertsResponse {
  /** Gemeinde (7-stelliger Gemeindeschlüssel), aus der die Meldungen stammen */
  area: string;
  /** Name der Gemeinde, falls bekannt, z. B. "Düsseldorf" */
  areaName: string | null;
  alerts: Alert[];
  source: DataSource;
  generatedAt: string;
}

/**
 * Live-Karte (#92): ein Fahrtabschnitt von Halt zu Halt. Die App berechnet die Position aus der
 * Zeit (Anteil zwischen Abfahrt und Ankunft) entlang `path`, ein Fahrzeug-GPS gibt es nicht.
 */
export interface VehicleSegment {
  /** Fahrt-ID der Quelle; gleiche ID = dasselbe Fahrzeug über mehrere Abschnitte */
  trip: string;
  line: string;
  mode: TransportMode;
  /** Linienfarbe als Hex ohne "#", falls bekannt */
  color: string | null;
  /** ISO-8601, Abfahrt am Start bzw. Ankunft am Ende des Abschnitts (mit Echtzeit, falls da) */
  departure: string;
  arrival: string;
  /** Abfahrt laut Echtzeit statt nur Fahrplan */
  realtime: boolean;
  /** Verspätung in Minuten (nur mit Echtzeit) */
  delayMinutes: number | null;
  /** Halt am Ende des Abschnitts */
  nextStop: string;
  /** Streckenverlauf `[lat, lon]`, mindestens 2 Punkte */
  path: [number, number][];
}

export interface VehiclesResponse {
  segments: VehicleSegment[];
  /** Zeitfenster der Abschnitte (ISO-8601) */
  from: string;
  to: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

// ---- Fahrtverlauf (#120) ----

export interface TripResponse {
  /** Die ganze Fahrt als ein Abschnitt: Start, alle Halte dazwischen, Ziel, Strecke */
  leg: JourneyLeg;
  source: DataSource;
  /** ISO-8601, Zeitpunkt der Datenabfrage */
  generatedAt: string;
}

// ---- Spracheingabe (#132) ----

export interface SpeechResponse {
  /** Erkannter Text */
  text: string;
}
