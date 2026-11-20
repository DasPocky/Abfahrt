// Hilfen für Komponententests: App mit Memory-Router und frischem QueryClient rendern.
import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { App } from "./App";
import { routes } from "./routes";
import { BASE_PATH } from "../shared/base-path";
import type {
  Alert,
  AlertsResponse,
  Departure,
  DeparturesResponse,
  Journey,
  JourneyLeg,
  JourneyStop,
  JourneysResponse,
  Stop,
} from "../shared/api-types";

export function renderAt(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`${BASE_PATH}${path}`],
    basename: BASE_PATH,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Kein Hinweis aus der Verwaltung: sonst holt die Startseite ihn mit und verbraucht Test-Antworten
  queryClient.setQueryData(["banner"], null);
  const result = render(<App router={router} queryClient={queryClient} />);
  return { ...result, router, queryClient };
}

export const STOP_HBF: Stop = {
  id: "vrr:de:05111:18235",
  name: "Düsseldorf Hbf",
  place: "Düsseldorf",
};

export function departure(overrides: Partial<Departure> & Pick<Departure, "id">): Departure {
  return {
    line: "U79",
    mode: "subway",
    direction: "Duisburg Meiderich Süd Bf",
    plannedTime: "2026-11-13T12:05:00Z",
    realtimeTime: "2026-11-13T12:05:00Z",
    platform: "2",
    plannedPlatform: "2",
    cancelled: false,
    lineColor: null,
    lineTextColor: null,
    notices: [],
    ...overrides,
  };
}

export function departuresResponse(
  departures: Departure[],
  overrides: Partial<DeparturesResponse> = {},
): DeparturesResponse {
  return {
    stop: STOP_HBF,
    departures,
    source: "vrr",
    generatedAt: "2026-11-13T12:00:00Z",
    ...overrides,
  };
}

export const STOP_HHA: Stop = {
  id: "vrr:de:05111:18036",
  name: "Heinrich-Heine-Allee",
  place: "Düsseldorf",
};

export function journeyStop(
  overrides: Partial<JourneyStop> & Pick<JourneyStop, "name">,
): JourneyStop {
  return {
    id: null,
    plannedArrival: null,
    realtimeArrival: null,
    plannedDeparture: null,
    realtimeDeparture: null,
    platform: null,
    plannedPlatform: null,
    cancelled: false,
    ...overrides,
  };
}

export function journeyLeg(overrides: Partial<JourneyLeg> = {}): JourneyLeg {
  return {
    kind: "transit",
    origin: journeyStop({
      ...STOP_HBF,
      plannedDeparture: "2026-11-13T12:05:00Z",
      realtimeDeparture: "2026-11-13T12:05:00Z",
      platform: "2",
      plannedPlatform: "2",
    }),
    destination: journeyStop({
      ...STOP_HHA,
      plannedArrival: "2026-11-13T12:12:00Z",
      realtimeArrival: "2026-11-13T12:12:00Z",
      platform: "1",
      plannedPlatform: "1",
    }),
    durationMinutes: 7,
    distanceMeters: null,
    line: "U79",
    mode: "subway",
    direction: "Duisburg Meiderich Süd Bf",
    lineColor: null,
    lineTextColor: null,
    intermediateStops: [],
    cancelled: false,
    notices: [],
    path: null,
    ...overrides,
  };
}

export function journey(overrides: Partial<Journey> & Pick<Journey, "id">): Journey {
  return { legs: [journeyLeg()], transfers: 0, durationMinutes: 7, ...overrides };
}

export function journeysResponse(
  journeys: Journey[],
  overrides: Partial<JourneysResponse> = {},
): JourneysResponse {
  return {
    from: STOP_HBF,
    to: STOP_HHA,
    journeys,
    source: "vrr",
    generatedAt: "2026-11-13T12:00:00Z",
    earlier: "2026-11-13T11:40:00.000Z",
    later: "2026-11-13T12:30:00.000Z",
    ...overrides,
  };
}

/** Störungsmeldung nach dem Muster der VRR-Daten (Straßenbahn, Baustelle an der Haltestelle) */
export function alert(overrides: Partial<Alert> & Pick<Alert, "id">): Alert {
  return {
    kind: "blocking",
    severity: "normal",
    title: "Straßenbahnlinie 709: Barrierefreier Ausbau der Haltestelle Flingern S, Steig 3",
    text: "Wegen Bauarbeiten hält die Linie 709 an der Ersatzhaltestelle in der Hoffeldstraße.",
    url: "https://www.vrr.de/de/stoerungsmeldungen/",
    validFrom: "2026-10-10T04:00:00Z",
    validTo: "2026-11-21T20:00:00Z",
    lines: [{ line: "709", mode: "tram" }],
    stops: [{ id: "vrr:de:05111:18560", name: "Flingern S" }],
    ...overrides,
  };
}

export function alertsResponse(
  alerts: Alert[],
  overrides: Partial<AlertsResponse> = {},
): AlertsResponse {
  return {
    area: "5111000",
    areaName: "Düsseldorf",
    alerts,
    source: "vrr",
    generatedAt: "2026-11-13T12:00:00Z",
    ...overrides,
  };
}

/** Request-URL eines fetch-Aufrufs als URL-Objekt */
export function requestUrl(input: unknown): URL {
  const raw = input instanceof Request ? input.url : String(input);
  return new URL(raw, "http://localhost");
}
