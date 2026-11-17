import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../test-utils";

afterEach(() => vi.restoreAllMocks());

describe("Benachrichtigungen", () => {
  it("meldet fehlende Unterstützung", async () => {
    renderAt("/mehr");
    expect(await screen.findByText(/unterstützt keine Benachrichtigungen/)).toBeInTheDocument();
  });

  it("erklärt am iPhone im Browser, dass die App installiert sein muss", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    );
    renderAt("/mehr");
    expect(await screen.findByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
  });
});
