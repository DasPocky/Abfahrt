// Service Worker der App, ausgeliefert als /abfahrt/sw.js und damit nur für den Scope /abfahrt/.
// Vorlage: Das Vite-Plugin in vite.config.ts ersetzt beim Build die Zeile BUILD durch die
// Build-Version und die Dateien der App-Hülle (siehe src/pwa/precache.ts).
const BUILD = { version: "dev", base: "/abfahrt", urls: [] };

// Die Origin endlab.de teilen sich mehrere Apps: nur eigene Caches anfassen.
const CACHE_PREFIX = "abfahrt-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD.version}`;
const SHELL_URL = `${BUILD.base}/`;
const API_PREFIX = `${BUILD.base}/api/`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: "reload" umgeht den HTTP-Cache, damit wirklich die Dateien dieses Builds landen
      .then((cache) => cache.addAll(BUILD.urls.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SHELL_URL)) return;
  // API-Antworten nie cachen: immer Netz, offline zeigt die App ihre Fehlermeldung
  if (url.pathname.startsWith(API_PREFIX)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else {
    event.respondWith(fromCache(request));
  }
});

/** Seitenaufrufe: zuerst Netz (neuester Stand), offline die gespeicherte App-Hülle */
async function navigate(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const shell = await caches.match(SHELL_URL, { cacheName: CACHE_NAME, ignoreVary: true });
    if (!shell) throw error;
    // Umgeleitete Antworten dürfen nicht für Navigationen verwendet werden
    return shell.redirected
      ? new Response(await shell.blob(), { status: shell.status, headers: shell.headers })
      : shell;
  }
}

/** Gebaute Dateien haben Hashes im Namen: aus dem Cache, sonst aus dem Netz */
async function fromCache(request) {
  // ignoreVary: Static Assets antworten mit „Vary: Origin“, Modul-Skripte und Schriften senden
  // einen Origin-Header, die vorab gespeicherten Anfragen nicht. Der Inhalt ist trotzdem gleich.
  const cached = await caches.match(request, { cacheName: CACHE_NAME, ignoreVary: true });
  return cached ?? fetch(request);
}
