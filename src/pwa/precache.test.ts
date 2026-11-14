import { describe, expect, it } from "vitest";
import { BUILD_PLACEHOLDER, precacheUrls, renderServiceWorker } from "./precache";
import template from "./service-worker.js?raw";

describe("precacheUrls", () => {
  it("nimmt die App-Hülle unter /abfahrt/ auf, nicht aber Fremdes", () => {
    const urls = precacheUrls([
      "index.html",
      ".assetsignore",
      "_headers",
      "abfahrt/assets/index-BnKAFR0j.js",
      "abfahrt/assets/index-BnKAFR0j.js.map",
      "abfahrt/assets/index-Q5H_YITN.css",
      "abfahrt/assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
      "abfahrt/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2",
      "abfahrt/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2",
      "abfahrt/manifest.webmanifest",
      "abfahrt/icons/icon-192.png",
      "abfahrt/sw.js",
      "abfahrt/.vite/manifest.json",
    ]);
    expect(urls).toEqual([
      "/abfahrt/",
      "/abfahrt/assets/index-BnKAFR0j.js",
      "/abfahrt/assets/index-Q5H_YITN.css",
      "/abfahrt/assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
      "/abfahrt/icons/icon-192.png",
      "/abfahrt/manifest.webmanifest",
    ]);
  });

  it("lässt die lazy geladene Karte samt MapLibre-Worker weg", () => {
    expect(
      precacheUrls([
        "abfahrt/assets/map-page-CX_qZUJr.js",
        "abfahrt/assets/map-page-qvkd0SPb.css",
        "abfahrt/assets/maplibre-gl-worker-CMkqA50c.mjs",
      ]),
    ).toEqual(["/abfahrt/"]);
  });

  it("versteht Windows-Pfade und entfernt Doppelte", () => {
    expect(precacheUrls(["abfahrt\\icons\\icon.svg", "abfahrt/icons/icon.svg"])).toEqual([
      "/abfahrt/",
      "/abfahrt/icons/icon.svg",
    ]);
  });
});

describe("renderServiceWorker", () => {
  it("setzt Version und Dateiliste in die Vorlage ein", () => {
    expect(template).toContain(BUILD_PLACEHOLDER);
    const code = renderServiceWorker(template, {
      version: "abc123",
      urls: ["/abfahrt/", "/abfahrt/assets/a$&.js"],
    });
    expect(code).not.toContain(BUILD_PLACEHOLDER);
    expect(code).toContain(
      'const BUILD = {"version":"abc123","base":"/abfahrt","urls":["/abfahrt/","/abfahrt/assets/a$&.js"]};',
    );
  });

  it("bricht ab, wenn der Platzhalter fehlt", () => {
    expect(() => renderServiceWorker("self.x = 1;", { version: "v", urls: [] })).toThrow(
      /Platzhalter/,
    );
  });
});
