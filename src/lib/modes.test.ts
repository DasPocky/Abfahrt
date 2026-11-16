import { describe, expect, it } from "vitest";
import { platformLabel } from "./modes";

describe("platformLabel", () => {
  it("nennt Eisenbahn Gleis und U-Bahn/Tram/Bus Steig", () => {
    expect(platformLabel("regional")).toBe("Gleis");
    expect(platformLabel("suburban")).toBe("Gleis");
    expect(platformLabel("longdistance")).toBe("Gleis");
    expect(platformLabel("subway")).toBe("Steig");
    expect(platformLabel("tram")).toBe("Steig");
    expect(platformLabel("bus")).toBe("Steig");
    expect(platformLabel("ferry")).toBe("Anleger");
  });
});
