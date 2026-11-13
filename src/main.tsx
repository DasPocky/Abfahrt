import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { createQueryClient } from "@/lib/query-client";
import { App } from "./App";
import { routes } from "./routes";
import { BASE_PATH } from "../shared/base-path";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root fehlt in index.html");

const router = createBrowserRouter(routes, { basename: BASE_PATH });
const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <App router={router} queryClient={queryClient} />
  </StrictMode>,
);
