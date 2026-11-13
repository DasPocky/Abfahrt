// Hilfen für Komponententests: App mit Memory-Router und frischem QueryClient rendern.
import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { App } from "./App";
import { routes } from "./routes";
import { BASE_PATH } from "../shared/base-path";
import type { Departure, DeparturesResponse, Stop } from "../shared/api-types";

export function renderAt(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`${BASE_PATH}${path}`],
    basename: BASE_PATH,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

/** Request-URL eines fetch-Aufrufs als URL-Objekt */
export function requestUrl(input: unknown): URL {
  const raw = input instanceof Request ? input.url : String(input);
  return new URL(raw, "http://localhost");
}
