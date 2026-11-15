import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JourneyList } from "./journey-list";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import type { Journey, JourneyLeg } from "../../shared/api-types";

const T = (hhmm: string) => `2026-11-13T${hhmm}:00Z`;

function stop(name: string, times: Partial<Record<"dep" | "rtDep" | "arr" | "rtArr", string>>) {
  return journeyStop({
    name,
    plannedDeparture: times.dep ? T(times.dep) : null,
    realtimeDeparture: times.rtDep ? T(times.rtDep) : null,
    plannedArrival: times.arr ? T(times.arr) : null,
    realtimeArrival: times.rtArr ? T(times.rtArr) : null,
  });
}

const WALK: JourneyLeg = journeyLeg({
  kind: "walk",
  line: null,
  mode: null,
  direction: null,
  durationMinutes: 3,
  distanceMeters: 180,
});

/** S6 mit 3 Min Verspätung, 3 Min Fußweg, Anschluss-Tram 1 Min später: gefährdet */
const TIGHT: Journey = journey({
  id: "tight",
  transfers: 1,
  legs: [
    journeyLeg({
      line: "S6",
      mode: "suburban",
      direction: "Essen Hbf",
      origin: journeyStop({
        ...stop("Düsseldorf Hbf", { dep: "12:00", rtDep: "12:03" }),
        platform: "5",
        plannedPlatform: "4",
      }),
      destination: stop("Düsseldorf-Rath", { arr: "12:10", rtArr: "12:13" }),
      intermediateStops: [
        { ...stop("Düsseldorf-Wehrhahn", { arr: "12:04", dep: "12:05", rtDep: "12:08" }) },
        {
          ...stop("Düsseldorf-Zoo", { arr: "12:07", dep: "12:07" }),
          platform: "2",
          cancelled: true,
        },
      ],
      notices: ["Bauarbeiten zwischen Rath und Ratingen", "Ersatzverkehr mit Bussen"],
    }),
    WALK,
    journeyLeg({
      line: "701",
      mode: "tram",
      direction: "Rath",
      origin: stop("Rath Mitte", { dep: "12:17" }),
      destination: stop("Am Hülserhof", { arr: "12:25" }),
    }),
  ],
});

/** Umstieg mit 5 Min Zeit, keine Echtzeit */
const OK: Journey = journey({
  id: "ok",
  transfers: 1,
  legs: [
    journeyLeg({ destination: stop("Heinrich-Heine-Allee", { arr: "12:10" }) }),
    journeyLeg({ line: "U75", origin: stop("Heinrich-Heine-Allee", { dep: "12:15" }) }),
  ],
});

/** Verspätung frisst den Anschluss */
const MISSED: Journey = journey({
  id: "missed",
  transfers: 1,
  legs: [
    journeyLeg({ destination: stop("Heinrich-Heine-Allee", { arr: "12:10", rtArr: "12:18" }) }),
    journeyLeg({ line: "U75", origin: stop("Heinrich-Heine-Allee", { dep: "12:15" }) }),
  ],
});

function rows() {
  // Nur die Zeilen selbst, nicht die Listeneinträge der aufgeklappten Details
  return [...screen.getByRole("list", { name: "Verbindungen" }).children].filter(
    (el) => el instanceof HTMLElement,
  );
}

function expand(row: HTMLElement) {
  fireEvent.click(within(row).getAllByRole("button")[0]!);
  return within(row).getByRole("list", { name: "Abschnitte" });
}

describe("JourneyList", () => {
  it("zeigt gefährdete Anschlüsse schon in der eingeklappten Zeile", () => {
    render(<JourneyList journeys={[TIGHT, OK, MISSED]} />);
    const [tight, ok, missed] = rows();
    expect(tight?.querySelector("[data-transfer-risk=tight]")).toHaveTextContent(
      "Anschluss gefährdet",
    );
    expect(tight?.querySelector("[data-transfer-risk=tight]")).toHaveClass("text-warning");
    expect(ok?.querySelector("[data-transfer-risk]")).toBeNull();
    expect(missed?.querySelector("[data-transfer-risk=missed]")).toHaveTextContent(
      "Anschluss nicht erreichbar",
    );
    expect(missed?.querySelector("[data-transfer-risk=missed]")).toHaveClass("text-destructive");
  });

  it("zeigt Umstiegszeit nach Abzug des Fußwegs und Abschnitte mit Gleiswechsel", () => {
    render(<JourneyList journeys={[TIGHT, OK, MISSED]} />);
    const legs = expand(rows()[0]!);
    expect(legs).toHaveTextContent("Düsseldorf Hbf · Gleis 5 statt 4");
    expect(legs).toHaveTextContent("Richtung Essen Hbf");
    expect(legs).toHaveTextContent("Fußweg 3 Min · 180 m");
    // 12:13 an (Echtzeit), 12:17 ab, 3 Min Fußweg → 1 Min Puffer
    const transfer = legs.querySelector("[data-transfer]");
    expect(transfer).toHaveAttribute("data-transfer", "tight");
    expect(transfer).toHaveTextContent("Anschluss gefährdet · 1 Min Umstieg");
    // Umstieg steht nach dem Fußweg, direkt vor der Anschlussfahrt
    expect(legs.textContent?.indexOf("Fußweg")).toBeLessThan(
      legs.textContent?.indexOf("1 Min Umstieg") ?? 0,
    );
  });

  it("zeigt die Umstiegszeit ohne Echtzeit nach Plan", () => {
    render(<JourneyList journeys={[TIGHT, OK, MISSED]} />);
    expect(expand(rows()[1]!).querySelector("[data-transfer=ok]")).toHaveTextContent(
      "5 Min Umstieg",
    );
    expect(expand(rows()[2]!).querySelector("[data-transfer=missed]")).toHaveTextContent(
      "Anschluss nicht erreichbar · 3 Min zu knapp",
    );
  });

  it("klappt Zwischenhalte auf, mit Echtzeit und Ausfall", () => {
    render(<JourneyList journeys={[TIGHT]} />);
    const legs = expand(rows()[0]!);
    const toggle = within(legs).getByRole("button", { name: /2 Zwischenhalte/ });
    expect(toggle).toHaveTextContent(/^2 Zwischenhalte\W+1 entfällt$/);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(legs).queryByRole("list", { name: "Zwischenhalte S6" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const stops = within(legs).getAllByRole("list", { name: "Zwischenhalte S6" })[0]!;
    const [wehrhahn, zoo] = within(stops).getAllByRole("listitem");
    expect(wehrhahn).toHaveTextContent(/Düsseldorf-Wehrhahn/);
    expect(wehrhahn?.querySelector("time")).toHaveAttribute("dateTime", T("12:05"));
    expect(wehrhahn?.querySelector("[data-tone=warning]")).toHaveTextContent("+3");
    expect(zoo).toHaveTextContent("Düsseldorf-Zoo · entfällt");
    expect(within(zoo!).getByText("Düsseldorf-Zoo")).toHaveClass("line-through");
  });

  it("zeigt Hinweise kompakt und vollständig im Panel", () => {
    render(<JourneyList journeys={[TIGHT]} />);
    const legs = expand(rows()[0]!);
    const trigger = within(legs).getByRole("button", { name: /^2 Hinweise zu S6 anzeigen/ });
    expect(trigger).toHaveTextContent("Bauarbeiten zwischen Rath und Ratingen+1");
    expect(screen.queryByText("Ersatzverkehr mit Bussen")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByText("Ersatzverkehr mit Bussen")).toBeInTheDocument();
  });

  it("markiert ausgefallene Abschnitte ohne Anschlusswarnung", () => {
    const cancelled = journey({
      id: "c",
      transfers: 1,
      legs: [MISSED.legs[0]!, { ...MISSED.legs[1]!, cancelled: true }],
    });
    render(<JourneyList journeys={[cancelled]} />);
    const row = rows()[0]!;
    expect(row).toHaveTextContent("fällt aus");
    expect(row.querySelector("[data-transfer-risk]")).toBeNull();
    const legs = expand(row);
    expect(legs).toHaveTextContent("Fahrt fällt aus");
    expect(legs.querySelector("[data-transfer]")).toBeNull();
  });
});
