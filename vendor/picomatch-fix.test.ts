// Regressionstest für den eigenen Fix von picomatch (GHSA-fc5q-39xc-vjpf und picomatch-Issue #175),
// siehe vendor/README.md. Muster aus der Meldung, den verknüpften Issues und eigene Varianten.
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

const LIMIT_MS = 200;

function duration(pattern: string, input: string): number {
  const re = picomatch.makeRe(pattern);
  const start = performance.now();
  re.test(input);
  return performance.now() - start;
}

describe("picomatch (Abfahrt-Fix)", () => {
  it("ist die angepasste Kopie", async () => {
    const pkg: unknown = await import("picomatch/package.json");
    expect(pkg).toMatchObject({ version: "4.0.7-abfahrt.2" });
  });

  it.each([
    // Meldung GHSA-fc5q-39xc-vjpf
    ["+(*)", `${"x".repeat(2000)}/`],
    ["+(*a)", `${"a".repeat(2000)}b`],
    // verwandte einzelne Zweige (picomatch #175, #194, #247)
    ["*(*a)", `${"a".repeat(2000)}b`],
    ["+(a*b)", `${"ab".repeat(1000)}a`],
    ["+(*?a)", `${"a".repeat(2000)}!`],
    ["*(*?)", `${"x".repeat(2000)}/`],
    ["+(*a*)c", `${"a".repeat(2000)}b`],
    ["x/+(*a)", `x/${"a".repeat(2000)}b`],
    ["+(*a).js", `${"a".repeat(2000)}.ts`],
    // zusammensetzbare Zweige (picomatch #175)
    ["+(ab|abab)", `${"ab".repeat(1000)}c`],
    ["*(ab|abab)", `${"ab".repeat(1000)}c`],
    ["+(abc|abcabc)", `${"abc".repeat(700)}d`],
    ["+(a|ab|aba)", `${"aba".repeat(700)}c`],
  ])("%s bleibt bei langen Eingaben schnell", (pattern, input) => {
    expect(duration(pattern, input)).toBeLessThan(LIMIT_MS);
  });

  it("behält die Bedeutung der Muster", () => {
    const cases: [string, string, boolean][] = [
      ["abc", "+(*)c", true],
      ["xa", "+(*a)", true],
      ["xab", "+(*a)", false],
      ["ffo", "*(f*(o))", true],
      ["ababab", "+(ab|abab)", true],
      ["aba", "+(ab|abab)", false],
      ["", "*(ab|abab)", false],
      ["foo/bar/baz.jsx", "foo/bar/*.+(js|jsx)", true],
      ["fofoofoofofoo", "*(fo|foo)", true],
      ["ax", "*(a*|b)", true],
      ["src/lib/a.ts", "src/**/*.{ts,tsx}", true],
    ];
    for (const [input, pattern, expected] of cases) {
      expect(picomatch.isMatch(input, pattern), `${pattern} ~ ${input}`).toBe(expected);
    }
  });
});
