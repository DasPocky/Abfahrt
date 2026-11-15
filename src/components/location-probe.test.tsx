import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../test-utils";

afterEach(() => Reflect.deleteProperty(navigator, "geolocation"));

describe("Standort testen", () => {
  it("zeigt eine sofortige Ablehnung des Browsers mit Code", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn<Geolocation["getCurrentPosition"]>((_ok, fail) =>
          fail?.({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          }),
        ),
      },
    });
    localStorage.setItem("abfahrt:location", "off");
    renderAt("/ueber");
    fireEvent.click(screen.getByRole("button", { name: "Standort jetzt anfordern" }));
    expect(
      await screen.findByText(/Fehler 1 nach \d+ ms: User denied Geolocation/),
    ).toHaveTextContent("sofort abgelehnt");
  });
});
