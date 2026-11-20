import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { BannerNotice } from "./banner-notice";

function renderWith(text: string | null) {
  const client = new QueryClient();
  client.setQueryData(["banner"], text);
  return render(
    <QueryClientProvider client={client}>
      <BannerNotice />
    </QueryClientProvider>,
  );
}

describe("Hinweis aus der Verwaltung", () => {
  it("zeigt den Text als Hinweis", () => {
    renderWith("Bauarbeiten am Hbf");
    expect(screen.getByRole("note")).toHaveTextContent("Bauarbeiten am Hbf");
  });

  it("ohne Hinweis nichts", () => {
    renderWith(null);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
