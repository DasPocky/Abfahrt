import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { departure } from "../test-utils";
import { DepartureList } from "./departure-list";

const NOW = new Date("2026-11-13T12:00:00Z");

function rows() {
  return within(screen.getByRole("list", { name: "Abfahrten" }))
    .getAllByRole("listitem")
    .filter((li) => li.parentElement?.getAttribute("aria-label") === "Abfahrten");
}

function rowAt(list: HTMLElement[], index: number): HTMLElement {
  const row = list[index];
  if (!row) throw new Error(`Zeile ${index} fehlt`);
  return row;
}

describe("DepartureList", () => {
  it("sortiert nach tatsächlicher Abfahrtszeit und zeigt Countdown, Planzeit und Verspätung", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[
          departure({
            id: "late",
            line: "U79",
            direction: "Duisburg",
            plannedTime: "2026-11-13T12:01:00Z",
            realtimeTime: "2026-11-13T12:07:00Z",
          }),
          departure({
            id: "onTime",
            line: "708",
            mode: "tram",
            direction: "Unterrath",
            plannedTime: "2026-11-13T12:03:00Z",
            realtimeTime: "2026-11-13T12:03:00Z",
          }),
          departure({
            id: "slight",
            line: "732",
            mode: "bus",
            direction: "Benrath",
            plannedTime: "2026-11-13T12:02:00Z",
            realtimeTime: "2026-11-13T12:04:00Z",
          }),
          departure({
            id: "far",
            line: "RE 5",
            mode: "regional",
            direction: "Koblenz Hbf",
            plannedTime: "2026-11-13T13:15:00Z",
            realtimeTime: null,
          }),
          departure({
            id: "now",
            line: "U75",
            direction: "Eller",
            plannedTime: "2026-11-13T12:00:20Z",
            realtimeTime: "2026-11-13T12:00:20Z",
          }),
        ]}
      />,
    );

    const list = rows();
    expect(
      list.map(
        (row) => within(row).getByText(/Unterrath|Duisburg|Benrath|Koblenz|Eller/).textContent,
      ),
    ).toEqual(["Eller", "Unterrath", "Benrath", "Duisburg", "Koblenz Hbf"]);

    const now = rowAt(list, 0);
    const onTime = rowAt(list, 1);
    const slight = rowAt(list, 2);
    const late = rowAt(list, 3);
    const far = rowAt(list, 4);
    expect(within(now).getByText("jetzt")).toBeInTheDocument();
    expect(within(onTime).getByText("in 3 Min")).toBeInTheDocument();
    expect(within(onTime).getByText("13:03")).toBeInTheDocument();
    expect(within(onTime).getByText("+0")).toHaveAttribute("data-tone", "success");
    expect(within(slight).getByText("+2")).toHaveAttribute("data-tone", "warning");
    expect(within(slight).getByText("+2")).toHaveClass("text-warning");
    expect(within(late).getByText("+6")).toHaveClass("text-destructive");
    // ab 60 Minuten Uhrzeit statt Countdown, ohne Echtzeit keine Verspätung
    expect(within(far).getAllByText("14:15")).toHaveLength(2);
    expect(within(far).queryByText(/^[+-]\d+$/)).toBeNull();
    expect(within(far).getByRole("img", { name: "Regionalzug" })).toBeInTheDocument();
  });

  it("färbt Linien-Badges in Linienfarbe mit Fallback nach Verkehrsmittel", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[
          departure({ id: "a", line: "U79", lineColor: "008fc2", lineTextColor: "ffffff" }),
          departure({ id: "b", line: "708", mode: "tram", plannedTime: "2026-11-13T12:06:00Z" }),
        ]}
      />,
    );
    expect(screen.getByText("U79")).toHaveStyle({
      backgroundColor: "rgb(0, 143, 194)",
      color: "rgb(255, 255, 255)",
    });
    expect(screen.getByText("708")).toHaveClass("bg-red-600");
  });

  it("markiert Ausfälle, Gleiswechsel und Hinweise", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[
          departure({
            id: "cancelled",
            line: "S1",
            mode: "suburban",
            direction: "Solingen Hbf",
            cancelled: true,
            notices: ["Bauarbeiten zwischen Hilden und Solingen"],
          }),
          departure({
            id: "moved",
            line: "RE 1",
            mode: "regional",
            direction: "Aachen Hbf",
            plannedTime: "2026-11-13T12:09:00Z",
            realtimeTime: "2026-11-13T12:09:00Z",
            platform: "11",
            plannedPlatform: "9",
          }),
        ]}
      />,
    );

    const cancelled = rowAt(rows(), 0);
    const moved = rowAt(rows(), 1);
    expect(cancelled).toHaveAttribute("data-cancelled", "true");
    expect(within(cancelled).getByText("fällt aus")).toHaveClass("text-destructive");
    expect(within(cancelled).getByText("Solingen Hbf")).toHaveClass("line-through");
    expect(
      within(cancelled).getByText("Bauarbeiten zwischen Hilden und Solingen"),
    ).toBeInTheDocument();

    const platform = within(moved).getByText(/Gleis 11/);
    expect(platform).toHaveAttribute("data-platform-change", "true");
    expect(platform).toHaveTextContent("Gleis 11 (statt 9)");
  });

  it("blendet abgefahrene Fahrten aus und meldet eine leere Liste", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[departure({ id: "gone", realtimeTime: "2026-11-13T11:55:00Z" })]}
      />,
    );
    expect(screen.getByText("Zurzeit keine Abfahrten an dieser Haltestelle.")).toBeInTheDocument();
  });
});
