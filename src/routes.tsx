import type { RouteObject } from "react-router";
import { Layout } from "@/components/layout";
import { AboutPage } from "@/pages/about-page";
import { AlertsPage } from "@/pages/alerts-page";
import { HomePage } from "@/pages/home-page";
import { JourneyPage } from "@/pages/journey-page";
import { LazyMapPage } from "@/pages/lazy-map-page";
import { MorePage } from "@/pages/more-page";
import { SettingsPage } from "@/pages/settings-page";
import { ImprintPage, PrivacyPage } from "@/pages/legal-page";
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
      { path: "mehr", element: <MorePage /> },
      { path: "einstellungen", element: <SettingsPage /> },
      { path: "ueber", element: <AboutPage /> },
      { path: "impressum", element: <ImprintPage /> },
      { path: "datenschutz", element: <PrivacyPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
