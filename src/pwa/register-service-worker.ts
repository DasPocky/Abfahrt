import { BASE_PATH } from "../../shared/base-path";

function register(): void {
  // Scope ausdrücklich /abfahrt/, damit andere Apps auf endlab.de unberührt bleiben
  navigator.serviceWorker
    .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
    .catch((error: unknown) => {
      console.warn("Service Worker konnte nicht registriert werden", error);
    });
}

/** Registriert den Service Worker (nur im Produktions-Build, dort erzeugt ihn vite.config.ts). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  // Erst nach dem Laden, damit das Vorab-Speichern den Seitenaufbau nicht bremst
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
