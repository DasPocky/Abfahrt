import { describe, expect, it } from "vitest";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import { DEFAULT_JOURNEY_OPTIONS } from "../../shared/journey-options";
import {
  countJourneyOptions,
  describeJourneyOptions,
  EMPTY_JOURNEY_QUERY,
  formatDuration,
  formatTransfers,
  isJourneyCancelled,
  journeyPath,
  journeyQueryFromParams,
  journeyQueryToParams,
  journeyTimes,
  swapJourneyQuery,
  timeChipLabel,
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
      options: DEFAULT_JOURNEY_OPTIONS,
    });
  });

  it("ignoriert ungültige Zeitpunkte und Ankunft ohne Zeitpunkt", () => {
    expect(journeyQueryFromParams(new URLSearchParams("zeit=morgen&ankunft=1"))).toEqual(
      EMPTY_JOURNEY_QUERY,
    );
  });

  it("schreibt die Parameter verlustfrei zurück", () => {
    const query = {
      from: FROM,
      to: TO,
      time: "2026-11-13T12:00:00.000Z",
      arrive: true,
      options: {
        exclude: ["longdistance" as const, "bus" as const],
        maxTransfers: 1,
        transferSpeed: "slow" as const,
        accessible: true,
      },
    };
    expect(journeyQueryFromParams(journeyQueryToParams(query))).toEqual(query);
    expect(journeyQueryToParams({ ...query, time: undefined }).has("ankunft")).toBe(false);
  });

  it("baut den Pfad und tauscht Start und Ziel", () => {
    expect(journeyPath()).toBe("/verbindung");
    expect(journeyPath({ ...EMPTY_JOURNEY_QUERY, from: FROM })).toBe(
      "/verbindung?von=vrr%3Ade%3A05111%3A18235&vonName=D%C3%BCsseldorf+Hbf",
    );
    expect(swapJourneyQuery({ ...EMPTY_JOURNEY_QUERY, from: FROM, to: TO })).toEqual({
      ...EMPTY_JOURNEY_QUERY,
      from: TO,
      to: FROM,
    });
  });

  it("liest Optionen aus deutschen Parametern und ignoriert Ungültiges", () => {
    const query = journeyQueryFromParams(
      new URLSearchParams("ohne=bus,auto,longdistance&umstiege=0&umstiegszeit=kurz&barrierefrei=1"),
    );
    expect(query.options).toEqual({
      exclude: ["bus", "longdistance"],
      maxTransfers: 0,
      transferSpeed: "fast",
      accessible: true,
    });
    expect(
      journeyQueryFromParams(new URLSearchParams("umstiege=9&umstiegszeit=x")).options,
    ).toEqual(DEFAULT_JOURNEY_OPTIONS);
  });

  it("beschreibt und zählt Optionen", () => {
    const options = {
      exclude: ["bus" as const, "longdistance" as const],
      maxTransfers: 1,
      transferSpeed: "slow" as const,
      accessible: true,
    };
    expect(describeJourneyOptions(options)).toBe(
      "ohne Fernzug, Bus · max. 1 Umstieg · mehr Umstiegszeit · barrierefrei",
    );
    expect(countJourneyOptions(options)).toBe(4);
    expect(describeJourneyOptions({ ...DEFAULT_JOURNEY_OPTIONS, maxTransfers: 0 })).toBe(
      "nur direkt",
    );
    expect(countJourneyOptions(DEFAULT_JOURNEY_OPTIONS)).toBe(0);
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

describe("Zeit-Chip", () => {
  const now = new Date("2026-11-15T10:00:00Z"); // 11:00 in Berlin

  it("zeigt jetzt, heute, morgen und spätere Tage", () => {
    expect(timeChipLabel(undefined, false, now)).toBe("Ab jetzt");
    expect(timeChipLabel("2026-11-15T14:30:00Z", false, now)).toBe("Ab 15:30");
    expect(timeChipLabel("2026-11-16T07:15:00Z", true, now)).toBe("An morgen 08:15");
    expect(timeChipLabel("2026-11-18T07:15:00Z", false, now)).toBe("Ab Mi., 18.11. 08:15");
  });
});
