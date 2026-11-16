import type { RouteObject } from "react-router";
import { Layout } from "@/components/layout";
import { AboutPage } from "@/pages/about-page";
import { AlertsPage } from "@/pages/alerts-page";
import { HomePage } from "@/pages/home-page";
import { JourneyPage } from "@/pages/journey-page";
import { LazyMapPage } from "@/pages/lazy-map-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { StopPage } from "@/pages/stop-page";
import { TripPage } from "@/pages/trip-page";

/** Routen relativ zum basename BASE_PATH ("/abfahrt") */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "haltestelle/:stopId", element: <StopPage /> },
      { path: "karte", element: <LazyMapPage /> },
      { path: "verbindung", element: <JourneyPage /> },
      { path: "fahrt", element: <TripPage /> },
      { path: "stoerungen", element: <AlertsPage /> },
      { path: "ueber", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
