// Regressionstest für den eigenen Fix von picomatch (GHSA-fc5q-39xc-vjpf, vendor/README.md)
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";

describe("picomatch (Abfahrt-Fix)", () => {
  it("ist die angepasste Kopie", async () => {
    const pkg: unknown = await import("picomatch/package.json");
    expect(pkg).toMatchObject({ version: "4.0.7-abfahrt.1" });
  });

  it.each(["+(*)", "+(*a)", "*(*a)", "+(a*)", "+(*a*)c", "*(x*y*z)"])(
    "%s bleibt bei langen Eingaben schnell",
    (pattern) => {
      const re = picomatch.makeRe(pattern);
      const start = performance.now();
      re.test(`${"a".repeat(3000)}b`);
      expect(performance.now() - start).toBeLessThan(200);
    },
  );

  it("behält die Bedeutung der Muster", () => {
    expect(picomatch.isMatch("abc", "+(*)c")).toBe(true);
    expect(picomatch.isMatch("xa", "+(*a)")).toBe(true);
    expect(picomatch.isMatch("xab", "+(*a)")).toBe(false);
    expect(picomatch.isMatch("", "*(*a)")).toBe(false);
    expect(picomatch.isMatch("ffo", "*(f*(o))")).toBe(true);
    expect(picomatch.isMatch("src/lib/a.ts", "src/**/*.{ts,tsx}")).toBe(true);
  });
});
