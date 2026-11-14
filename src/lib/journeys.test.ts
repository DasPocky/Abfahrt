import { describe, expect, it } from "vitest";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import {
  EMPTY_JOURNEY_QUERY,
  formatDuration,
  formatTransfers,
  isJourneyCancelled,
  journeyPath,
  journeyQueryFromParams,
  journeyQueryToParams,
  journeyTimes,
  swapJourneyQuery,
} from "./journeys";

const FROM = { id: "vrr:de:05111:18235", name: "Düsseldorf Hbf" };
const TO = { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee" };

describe("URL-Parameter der Verbindungssuche", () => {
  it("liest Start, Ziel, Zeitpunkt und Ankunft", () => {
    const query = journeyQueryFromParams(
      new URLSearchParams(
        "von=vrr:de:05111:18235&vonName=D%C3%BCsseldorf+Hbf&nach=vrr:de:05111:18036&zeit=2026-11-13T12:00:00Z&ankunft=1",
      ),
    );
    expect(query).toEqual({
      from: FROM,
      to: { id: TO.id, name: "" },
      time: "2026-11-13T12:00:00.000Z",
      arrive: true,
    });
  });

  it("ignoriert ungültige Zeitpunkte und Ankunft ohne Zeitpunkt", () => {
    expect(journeyQueryFromParams(new URLSearchParams("zeit=morgen&ankunft=1"))).toEqual(
      EMPTY_JOURNEY_QUERY,
    );
  });

  it("schreibt die Parameter verlustfrei zurück", () => {
    const query = { from: FROM, to: TO, time: "2026-11-13T12:00:00.000Z", arrive: true };
    expect(journeyQueryFromParams(journeyQueryToParams(query))).toEqual(query);
    expect(journeyQueryToParams({ ...query, time: undefined }).has("ankunft")).toBe(false);
  });

  it("baut den Pfad und tauscht Start und Ziel", () => {
    expect(journeyPath()).toBe("/verbindung");
    expect(journeyPath({ from: FROM, to: null, arrive: false })).toBe(
      "/verbindung?von=vrr%3Ade%3A05111%3A18235&vonName=D%C3%BCsseldorf+Hbf",
    );
    expect(swapJourneyQuery({ from: FROM, to: TO, arrive: false })).toEqual({
      from: TO,
      to: FROM,
      arrive: false,
    });
  });
});

describe("Anzeige-Hilfen", () => {
  it("formatiert Dauer und Umstiege kompakt", () => {
    expect(formatDuration(42)).toBe("42 Min");
    expect(formatDuration(60)).toBe("1 Std");
    expect(formatDuration(65)).toBe("1 Std 5 Min");
    expect(formatTransfers(0)).toBe("direkt");
    expect(formatTransfers(1)).toBe("1 Umstieg");
    expect(formatTransfers(2)).toBe("2 Umstiege");
  });

  it("nimmt Abfahrt vom ersten und Ankunft vom letzten Abschnitt", () => {
    const walk = journeyLeg({
      kind: "walk",
      origin: journeyStop({
        name: "Heinrich-Heine-Allee",
        plannedDeparture: "2026-11-13T12:12:00Z",
      }),
      destination: journeyStop({ name: "Altstadt", plannedArrival: "2026-11-13T12:18:00Z" }),
    });
    expect(journeyTimes(journey({ id: "j", legs: [journeyLeg(), walk] }))).toEqual({
      plannedDeparture: "2026-11-13T12:05:00Z",
      realtimeDeparture: "2026-11-13T12:05:00Z",
      plannedArrival: "2026-11-13T12:18:00Z",
      realtimeArrival: null,
    });
  });

  it("erkennt Ausfälle von Fahrten und genutzten Halten", () => {
    expect(isJourneyCancelled(journey({ id: "a" }))).toBe(false);
    expect(isJourneyCancelled(journey({ id: "b", legs: [journeyLeg({ cancelled: true })] }))).toBe(
      true,
    );
    const stopCancelled = journeyLeg({
      destination: journeyStop({ name: "Ziel", cancelled: true }),
    });
    expect(isJourneyCancelled(journey({ id: "c", legs: [stopCancelled] }))).toBe(true);
  });
});
