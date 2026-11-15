import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneyList } from "./journey-list";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import type { RouteData } from "@/lib/route-map";

// MapLibre braucht WebGL, das jsdom nicht hat: die Karte selbst wird ersetzt
vi.mock("@/components/route-map", () => ({
  RouteMap: ({ data, dark, label }: { data: RouteData; dark: boolean; label: string }) => (
    <div role="region" aria-label={label} data-dark={dark}>
      {data.lines.features.length} Linien, {data.points.features.length} Punkte, Ausschnitt{" "}
      {JSON.stringify(data.bounds)}
    </div>
  ),
}));

const WITH_PATH = journey({
  id: "mit",
  legs: [
    journeyLeg({
      origin: journeyStop({ name: "Düsseldorf Hbf", lat: 51.21954, lon: 6.79427 }),
      destination: journeyStop({ name: "Heinrich-Heine-Allee", lat: 51.22609, lon: 6.77668 }),
      path: [
        [51.21954, 6.79427],
        [51.2231, 6.7855],
        [51.22609, 6.77668],
      ],
    }),
  ],
});

const WITHOUT = journey({ id: "ohne" });

function expandRow(index: number) {
  const row = within(screen.getByRole("list", { name: "Verbindungen" })).getAllByRole("listitem")[
    index
  ]!;
  fireEvent.click(within(row).getAllByRole("button")[0]!);
  return row;
}

describe("Routenkarte in den Details", () => {
  it("zeigt nach „Karte“ die lazy geladene Karte mit Quellhinweis", async () => {
    render(<JourneyList journeys={[WITH_PATH]} />);
    const row = expandRow(0);
    const toggle = within(row).getByRole("button", { name: "Karte" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const map = await within(row).findByRole("region", {
      name: "Routenkarte von Düsseldorf Hbf nach Heinrich-Heine-Allee",
    });
    expect(map).toHaveTextContent("1 Linien, 2 Punkte");
    expect(map).toHaveTextContent("[[6.77668,51.21954],[6.79427,51.22609]]");
    expect(map).toHaveAttribute("data-dark", "false");
    expect(within(row).getByRole("link", { name: "OpenStreetMap-Mitwirkende" })).toBeVisible();

    fireEvent.click(toggle);
    expect(within(row).queryByRole("region")).toBeNull();
  });

  it("bietet ohne Lagedaten keine Karte an", () => {
    render(<JourneyList journeys={[WITHOUT]} />);
    const row = expandRow(0);
    expect(within(row).getByRole("list", { name: "Abschnitte" })).toBeVisible();
    expect(within(row).queryByRole("button", { name: "Karte" })).toBeNull();
  });
});
