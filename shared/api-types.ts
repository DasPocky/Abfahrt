// Vertrag zwischen Worker-API und App. Quellenunabhängig (VRR, Transitous).

export type TransportMode =
  "tram" | "subway" | "bus" | "suburban" | "regional" | "longdistance" | "ferry" | "other";

export type DataSource = "vrr" | "transitous";

export interface Stop {
  /** Quellen-präfixierte ID, z. B. "vrr:de:05111:18036" oder "transitous:…" */
  id: string;
  name: string;
  /** Ort, z. B. "Düsseldorf" */
  place?: string;
  lat?: number;
  lon?: number;
  /** Nur Suche: Passgenauigkeit 0–1000 (höher = besser), für das Ranking nach Nähe in der App */
  relevance?: number;
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

export interface ApiError {
  error: string;
  message?: string;
}
