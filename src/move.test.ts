import { describe, expect, it } from "vitest";
import { decodeMove, encodeMove, movePlan } from "../shared/move";
import { isNavigation, movePage } from "../worker/move";

/** Führt das Skript der Umzugsseite mit einem erfundenen Speicher aus und liefert das Ziel */
async function follow(
  store: Record<string, string>,
  target = "https://abfahrt.endlab.de/karte?x=1",
) {
  const html = await movePage(target).text();
  const script = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(html)?.[1] ?? "";
  const keys = Object.keys(store);
  let went = "";
  // Eigene Namen statt der echten Browser-Objekte: das Skript sieht nur diesen Speicher
  // oxlint-disable-next-line typescript/no-implied-eval -- genau das Skript der Seite prüfen
  const run = new Function("localStorage", "location", script);
  Reflect.apply(run, undefined, [
    {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => store[k] ?? null,
    },
    {
      replace: (u: string) => {
        went = u;
      },
    },
  ]);
  return went;
}

const hasSettings = (k: string) => k === "abfahrt:settings";
const req = (h: Record<string, string>) =>
  new Request("https://endlab.de/abfahrt/", { headers: h });

describe("Umzug nach abfahrt.endlab.de", () => {
  it("packt nur Abfahrt-Einträge ein, ohne Push-Merker, und die neue Adresse liest sie", async () => {
    const went = await follow({
      "abfahrt:favorites": '[{"name":"Düsseldorf Hbf"}]',
      "abfahrt:push-sent": "x",
      "spieltisch:profile": "p",
    });
    const [base, hash] = went.split("#umzug=");
    expect(base).toBe("https://abfahrt.endlab.de/karte?x=1");
    expect(decodeMove(hash ?? "")).toEqual({ "abfahrt:favorites": '[{"name":"Düsseldorf Hbf"}]' });
  });

  it("leitet ohne Daten ohne Anker weiter", async () => {
    expect(await follow({})).toBe("https://abfahrt.endlab.de/karte?x=1");
  });

  it("lässt ein Ziel mit </script> nicht aus dem Skript ausbrechen", async () => {
    const html = await movePage("https://abfahrt.endlab.de/</script><b>").text();
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("übernimmt nur, was auf der neuen Adresse fehlt", () => {
    expect(movePlan({ "abfahrt:settings": "alt", "abfahrt:recent": "[]" }, hasSettings)).toEqual([
      ["abfahrt:recent", "[]"],
    ]);
  });

  it("verwirft fremde Schlüssel und Unsinn", () => {
    expect(decodeMove(encodeMove({ "spieltisch:x": "1", "abfahrt:a": "2" }))).toEqual({
      "abfahrt:a": "2",
    });
    expect(decodeMove("%%%")).toBeNull();
  });

  it("zieht nur Seitenaufrufe um, nicht Dateien und fetch", () => {
    expect(isNavigation(req({ "sec-fetch-mode": "navigate" }))).toBe(true);
    expect(isNavigation(req({ "sec-fetch-mode": "cors", accept: "text/html" }))).toBe(false);
  });
});
