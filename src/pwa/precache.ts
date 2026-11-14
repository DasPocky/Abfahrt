// Reine Build-Logik für den Service Worker (genutzt vom Vite-Plugin in vite.config.ts).
import { BASE_PATH } from "../../shared/base-path";

/** Zeile in src/pwa/service-worker.js, die beim Build ersetzt wird */
export const BUILD_PLACEHOLDER = 'const BUILD = { version: "dev", base: "/abfahrt", urls: [] };';

const FONT_FILE = /\.woff2?$/;

/**
 * Welche Ausgabedateien gehören zur Offline-Hülle?
 *
 * `fileNames` sind Pfade relativ zu dist/client (Bundle + public/). Es zählen nur Dateien unter
 * dem App-Präfix (abfahrt/…), ohne versteckte Dateien, Source Maps und den Service Worker selbst.
 * Schriften nur im Zeichensatz „latin“ (enthält Umlaute und ß), die übrigen Teilmengen lädt der
 * Browser nur bei Bedarf über das Netz. Statt index.html steht die Start-URL „/abfahrt/“ in der Liste, denn
 * /index.html liegt in Produktion außerhalb der Route endlab.de/abfahrt*.
 */
export function precacheUrls(fileNames: Iterable<string>, base: string = BASE_PATH): string[] {
  const prefix = `${base.slice(1)}/`;
  const urls = new Set<string>([`${base}/`]);
  for (const raw of fileNames) {
    const name = raw.replaceAll("\\", "/");
    if (!name.startsWith(prefix)) continue;
    const segments = name.split("/");
    const file = segments.at(-1) ?? "";
    if (segments.some((segment) => segment.startsWith("."))) continue; // z. B. .vite/
    if (file.endsWith(".map") || file === "sw.js") continue;
    if (FONT_FILE.test(file) && !/-latin-(?!ext)/.test(file)) continue;
    urls.add(`/${name}`);
  }
  return [...urls].toSorted();
}

/** Setzt Version und Dateiliste in die Vorlage des Service Workers ein. */
export function renderServiceWorker(
  template: string,
  build: { version: string; urls: readonly string[] },
  base: string = BASE_PATH,
): string {
  if (!template.includes(BUILD_PLACEHOLDER)) {
    throw new Error("Service-Worker-Vorlage: Platzhalter für BUILD fehlt");
  }
  const value = JSON.stringify({ version: build.version, base, urls: build.urls });
  return template.replace(BUILD_PLACEHOLDER, () => `const BUILD = ${value};`);
}
