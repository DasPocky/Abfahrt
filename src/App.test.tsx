import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("zeigt den Titel", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: "ok" }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "Abfahrt" })).toBeInTheDocument();
  });

  it("meldet eine erreichbare API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: "ok" }));
    render(<App />);
    expect(await screen.findByText("API erreichbar")).toBeInTheDocument();
  });

  it("meldet eine nicht erreichbare API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<App />);
    expect(await screen.findByText("API nicht erreichbar")).toBeInTheDocument();
  });
});
