import { describe, expect, it } from "vitest";
import { PAGE_SECURITY_HEADERS } from "../../worker/security-headers";
import headersFile from "../../public/_headers?raw";

/** Header-Zeilen des Blocks „/*“ in public/_headers */
function staticHeaders(): Record<string, string> {
  const lines = headersFile.split("\n");
  const start = lines.findIndex((l) => l.trim() === "/*");
  const result: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    const index = line.indexOf(":");
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

describe("Security-Header", () => {
  it("sind für vom Worker ausgelieferte Seiten gleich wie in public/_headers", () => {
    expect(PAGE_SECURITY_HEADERS).toEqual(staticHeaders());
  });
});
