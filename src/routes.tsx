import { AdminPage } from "@/pages/admin-page";
import { ClaimPage } from "@/pages/claim-page";
import type { RouteObject } from "react-router";
import { Layout } from "@/components/layout";
import { AboutPage } from "@/pages/about-page";
import { AccessibilityPage } from "@/pages/accessibility-page";
import { AlertsPage } from "@/pages/alerts-page";
import { HomePage } from "@/pages/home-page";
import { JourneyPage } from "@/pages/journey-page";
import { LazyMapPage } from "@/pages/lazy-map-page";
import { MorePage } from "@/pages/more-page";
import { SettingsPage } from "@/pages/settings-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { StopPage } from "@/pages/stop-page";
import { TripPage } from "@/pages/trip-page";
import { TripRoutePage } from "@/pages/trip-route-page";

/** Routen relativ zum basename BASE_PATH (leer: an der Wurzel) */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "haltestelle/:stopId", element: <StopPage /> },
      { path: "karte", element: <LazyMapPage /> },
      { path: "verbindung", element: <JourneyPage /> },
      { path: "fahrt", element: <TripPage /> },
      { path: "verlauf", element: <TripRoutePage /> },
      { path: "stoerungen", element: <AlertsPage /> },
      { path: "mehr", element: <MorePage /> },
      { path: "einstellungen", element: <SettingsPage /> },
      { path: "profil/uebernehmen/:code", element: <ClaimPage /> },
      { path: "verwaltung", element: <AdminPage /> },
      { path: "ueber", element: <AboutPage /> },
      { path: "barrierefreiheit", element: <AccessibilityPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
