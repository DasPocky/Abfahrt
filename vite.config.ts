import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { BASE_PATH } from "./shared/base-path";
import { precacheUrls, renderServiceWorker } from "./src/pwa/precache";

const SW_TEMPLATE = fileURLToPath(new URL("./src/pwa/service-worker.js", import.meta.url));

/** Alle Dateien unter `dir`, relativ zu `dir` */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

/**
 * Erzeugt beim Build den Service Worker abfahrt/sw.js (Scope /abfahrt/) aus der Vorlage
 * src/pwa/service-worker.js: Dateiliste der App-Hülle + Version aus dem Inhalt aller Dateien.
 * Ändert sich eine Datei, ändert sich die Version, der Browser installiert den neuen Service
 * Worker und dieser löscht die alten Caches.
 */
function serviceWorker(): Plugin {
  let publicDir = "";
  return {
    name: "abfahrt:service-worker",
    apply: "build",
    enforce: "post",
    applyToEnvironment: (environment) => environment.name === "client",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const template = readFileSync(SW_TEMPLATE, "utf8");
      const publicFiles = publicDir ? listFiles(publicDir) : [];
      const hash = createHash("sha256").update(template);
      for (const name of Object.keys(bundle).toSorted()) {
        const item = bundle[name];
        hash.update(name);
        if (item?.type === "chunk") hash.update(item.code);
        else if (item) hash.update(item.source);
      }
      for (const name of publicFiles.toSorted()) {
        hash.update(name).update(readFileSync(join(publicDir, name)));
      }
      const urls = precacheUrls([...Object.keys(bundle), ...publicFiles]);
      this.emitFile({
        type: "asset",
        fileName: `${BASE_PATH.slice(1)}/sw.js`,
        source: renderServiceWorker(template, { version: hash.digest("hex").slice(0, 12), urls }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), serviceWorker()],
  build: {
    // Assets liegen unter /abfahrt/assets/, passend zur Route endlab.de/abfahrt*
    assetsDir: "abfahrt/assets",
    // Die Karte (lazy, mit MapLibre) ist bewusst ein großer eigener Chunk, siehe src/routes.tsx
    chunkSizeWarningLimit: 1200,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
