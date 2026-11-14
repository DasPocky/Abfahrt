import type { RouteObject } from "react-router";
import { Layout } from "@/components/layout";
import { AboutPage } from "@/pages/about-page";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { StopPage } from "@/pages/stop-page";

/** Routen relativ zum basename BASE_PATH ("/abfahrt") */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "haltestelle/:stopId", element: <StopPage /> },
      { path: "ueber", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
