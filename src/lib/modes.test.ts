import { describe, expect, it } from "vitest";
import { platformLabel } from "./modes";

describe("platformLabel", () => {
  it("unterscheidet Bahn-Gleis, U-Bahn-Gleis und Steig", () => {
    expect(platformLabel("regional")).toBe("Gleis");
    expect(platformLabel("suburban")).toBe("Gleis");
    expect(platformLabel("longdistance")).toBe("Gleis");
    expect(platformLabel("subway")).toBe("U-Bahn-Gleis");
    expect(platformLabel("tram")).toBe("Steig");
    expect(platformLabel("bus")).toBe("Steig");
    expect(platformLabel("ferry")).toBe("Anleger");
  });
});
