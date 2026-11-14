import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { departure } from "../test-utils";
import { DepartureList, StopNoticesBanner } from "./departure-list";

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
    expect(within(onTime).getByLabelText("in 3 Min")).toHaveTextContent("3Min");
    expect(within(onTime).getByText("13:03")).toBeInTheDocument();
    // pünktlich: kein „+0“, nur Planzeit und dezent „pünktlich“
    expect(within(onTime).queryByText("+0")).toBeNull();
    expect(within(onTime).getByText("pünktlich")).toHaveAttribute("data-tone", "success");
    expect(within(onTime).getByText("pünktlich")).not.toHaveClass("font-semibold");
    expect(within(slight).getByText("+2")).toHaveAttribute("data-tone", "warning");
    expect(within(slight).getByText("+2")).toHaveClass("text-warning");
    expect(within(late).getByText("+6")).toHaveClass("text-destructive");
    // ab 60 Minuten Uhrzeit statt Countdown, ohne Echtzeit keine Verspätung
    expect(within(far).getAllByText("14:15")).toHaveLength(2);
    expect(within(far).queryByText(/^[+-]\d+$/)).toBeNull();
    expect(within(far).getByRole("img", { name: "Regionalzug" })).toBeInTheDocument();
  });

  it("zeigt lange Linienbezeichnungen ohne Symbol, aber mit Verkehrsmittel für Screenreader", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[departure({ id: "ice", line: "ICE 1023", mode: "longdistance" })]}
      />,
    );
    const row = rowAt(rows(), 0);
    expect(within(row).queryByRole("img")).toBeNull();
    expect(within(row).getByText("ICE 1023")).toBeInTheDocument();
    expect(within(row).getByText("Fernzug", { exact: false })).toHaveClass("sr-only");
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
    // Farbe sitzt am Linienfeld, der Text in einem inneren Element
    expect(screen.getByText("U79").parentElement).toHaveStyle({
      backgroundColor: "rgb(0, 143, 194)",
      color: "rgb(255, 255, 255)",
    });
    expect(screen.getByText("708").parentElement).toHaveClass("bg-red-600");
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
    // Hinweis als schlanke, gekürzte Zeile unter der Fahrt
    expect(within(cancelled).getByText("Bauarbeiten zwischen Hilden und Solingen")).toHaveClass(
      "truncate",
    );
    expect(
      within(cancelled).getByRole("button", { name: /^Hinweise zu S1 anzeigen/ }),
    ).toBeInTheDocument();

    const platform = moved.querySelector("[data-platform-change]");
    // Kästchen: Bezeichnung, Nummer, „statt“ bei Gleiswechsel
    expect(platform).toHaveTextContent("Gleis11statt 9");
    // Ausfall: kein Gleis-Kästchen
    expect(cancelled.querySelector("[data-platform-change]")).toBeNull();
  });

  it("öffnet die Hinweise einer Fahrt per ⓘ-Button in einem Panel", () => {
    const long =
      "Wegen Bauarbeiten zwischen Hilden und Solingen fahren Ersatzbusse, bitte längere Fahrzeit einplanen";
    render(
      <DepartureList
        now={NOW}
        departures={[
          departure({ id: "a", line: "S1", direction: "Solingen Hbf", notices: [long, "Kurzzug"] }),
          departure({ id: "b", line: "U79", plannedTime: "2026-11-13T12:06:00Z" }),
        ]}
      />,
    );
    const [first, second] = [rowAt(rows(), 0), rowAt(rows(), 1)];
    expect(within(second).queryByRole("button")).toBeNull();
    // in der Zeile nur gekürzt (erste Meldung + Anzahl weiterer)
    expect(within(first).getByText(long)).toHaveClass("truncate");
    expect(within(first).getByText("+1")).toBeInTheDocument();
    // ohne Sammelhinweise kein Hinweis über der Liste
    expect(screen.queryByRole("button", { name: /für diese Haltestelle/ })).toBeNull();

    const button = within(first).getByRole("button", { name: /^2 Hinweise zu S1 anzeigen/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog", { name: "Hinweise zu S1" });
    expect(within(dialog).getByText(long)).toBeVisible();
    expect(within(dialog).getByText("Kurzzug")).toBeVisible();
    expect(within(dialog).getByText(/Solingen Hbf/)).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fasst Hinweise mehrerer Fahrten oben für die Haltestelle zusammen", () => {
    const shared = "Aufzug zu Gleis 3 außer Betrieb";
    const deps = [
      departure({ id: "a", line: "U79", notices: [shared] }),
      departure({
        id: "b",
        line: "U78",
        plannedTime: "2026-11-13T12:06:00Z",
        notices: [shared, "Kurzzug"],
      }),
      departure({ id: "c", line: "U75", plannedTime: "2026-11-13T12:07:00Z" }),
    ];
    render(
      <>
        <StopNoticesBanner now={NOW} departures={deps} />
        <DepartureList now={NOW} departures={deps} />
      </>,
    );
    // Sammelhinweis nur oben, in den Zeilen nicht noch einmal gezählt
    expect(within(rowAt(rows(), 0)).queryByRole("button")).toBeNull();
    expect(
      within(rowAt(rows(), 1)).getByRole("button", { name: /^Hinweise zu U78 anzeigen/ }),
    ).toBeInTheDocument();

    const summary = screen.getByRole("button", { name: /^1 Hinweis für diese Haltestelle/ });
    fireEvent.click(summary);
    const dialog = screen.getByRole("dialog", { name: "Hinweise für diese Haltestelle" });
    expect(within(dialog).getByText(shared)).toBeVisible();
    expect(within(dialog).queryByText("Kurzzug")).toBeNull();
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

  it("benennt Halteplätze: Gleis für Schienenverkehr, Steig für Bus und Tram", () => {
    render(
      <DepartureList
        now={NOW}
        departures={[
          departure({ id: "s", line: "S6", mode: "suburban", platform: "2", plannedPlatform: "2" }),
          departure({
            id: "u",
            line: "U79",
            mode: "subway",
            platform: "2",
            plannedPlatform: "2",
            plannedTime: "2026-11-13T12:06:00Z",
          }),
          departure({
            id: "b",
            line: "721",
            mode: "bus",
            platform: "14",
            plannedPlatform: "14",
            plannedTime: "2026-11-13T12:07:00Z",
          }),
        ]}
      />,
    );
    expect(rowAt(rows(), 0)).toHaveTextContent("Gleis2");
    expect(rowAt(rows(), 1)).toHaveTextContent("Gleis2");
    expect(rowAt(rows(), 2)).toHaveTextContent("Steig14");
  });
});
