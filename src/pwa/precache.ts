// Reine Build-Logik für den Service Worker (genutzt vom Vite-Plugin in vite.config.ts).
import { BASE_PATH } from "../../shared/base-path";

/** Zeile in src/pwa/service-worker.js, die beim Build ersetzt wird */
export const BUILD_PLACEHOLDER = 'const BUILD = { version: "dev", base: "", urls: [] };';

const FONT_FILE = /\.woff2?$/;
/** Karte samt MapLibre (ca. 1,6 MB): nur bei Bedarf aus dem Netz, nicht in der Offline-Hülle */
const ON_DEMAND_FILE = /^(map-page|maplibre-gl-worker)-/;

/**
 * Welche Ausgabedateien gehören zur Offline-Hülle?
 *
 * `fileNames` sind Pfade relativ zu dist/client (Bundle + public/). Es zählen nur Dateien unter
 * dem App-Präfix (falls gesetzt), ohne versteckte Dateien, Source Maps und den Service Worker selbst.
 * Schriften nur im Zeichensatz „latin“ (enthält Umlaute und ß), die übrigen Teilmengen lädt der
 * Browser nur bei Bedarf über das Netz. Ebenso die Karte, die ohne Netz ohnehin nichts zeigt.
 * Statt index.html steht die Start-URL in der Liste; die App-Seiten liefert der Worker aus.
 */
export function precacheUrls(fileNames: Iterable<string>, base: string = BASE_PATH): string[] {
  const prefix = base ? `${base.slice(1)}/` : "";
  const urls = new Set<string>([`${base}/`]);
  for (const raw of fileNames) {
    const name = raw.replaceAll("\\", "/");
    if (!name.startsWith(prefix)) continue;
    const segments = name.split("/");
    const file = segments.at(-1) ?? "";
    if (segments.some((segment) => segment.startsWith("."))) continue; // z. B. .vite/
    if (file.startsWith("_")) continue; // _headers: Einstellung für Cloudflare, keine Datei der App
    if (file.endsWith(".map") || file === "sw.js" || name === "index.html") continue;
    if (FONT_FILE.test(file) && !/-latin-(?!ext)/.test(file)) continue;
    if (ON_DEMAND_FILE.test(file)) continue;
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
