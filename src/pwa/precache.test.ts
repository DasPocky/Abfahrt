import { describe, expect, it } from "vitest";
import { BUILD_PLACEHOLDER, precacheUrls, renderServiceWorker } from "./precache";
import template from "./service-worker.js?raw";

describe("precacheUrls", () => {
  it("nimmt die App-Hülle auf, nicht aber Fremdes", () => {
    const urls = precacheUrls([
      "index.html",
      ".assetsignore",
      "_headers",
      "assets/index-BnKAFR0j.js",
      "assets/index-BnKAFR0j.js.map",
      "assets/index-Q5H_YITN.css",
      "assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
      "assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2",
      "assets/inter-cyrillic-wght-normal-DqGufNeO.woff2",
      "manifest.webmanifest",
      "icons/icon-192.png",
      "sw.js",
      ".vite/manifest.json",
    ]);
    expect(urls).toEqual([
      "/",
      "/assets/index-BnKAFR0j.js",
      "/assets/index-Q5H_YITN.css",
      "/assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
    ]);
  });

  it("lässt die lazy geladene Karte samt MapLibre-Worker weg", () => {
    expect(
      precacheUrls([
        "assets/map-page-CX_qZUJr.js",
        "assets/map-page-qvkd0SPb.css",
        "assets/maplibre-gl-worker-CMkqA50c.mjs",
      ]),
    ).toEqual(["/"]);
  });

  it("versteht Windows-Pfade und entfernt Doppelte", () => {
    expect(precacheUrls(["icons\\icon.svg", "icons/icon.svg"])).toEqual(["/", "/icons/icon.svg"]);
  });
});

describe("renderServiceWorker", () => {
  it("setzt Version und Dateiliste in die Vorlage ein", () => {
    expect(template).toContain(BUILD_PLACEHOLDER);
    const code = renderServiceWorker(template, {
      version: "abc123",
      urls: ["/", "/assets/a$&.js"],
    });
    expect(code).not.toContain(BUILD_PLACEHOLDER);
    expect(code).toContain(
      'const BUILD = {"version":"abc123","base":"","urls":["/","/assets/a$&.js"]};',
    );
  });

  it("bricht ab, wenn der Platzhalter fehlt", () => {
    expect(() => renderServiceWorker("self.x = 1;", { version: "v", urls: [] })).toThrow(
      /Platzhalter/,
    );
  });
});
