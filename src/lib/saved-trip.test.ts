import { describe, expect, it } from "vitest";
import { journey, journeyLeg, journeyStop, STOP_HBF, STOP_HHA } from "../test-utils";
import { DEFAULT_JOURNEY_OPTIONS } from "../../shared/journey-options";
import {
  findJourney,
  isTripOver,
  journeySignature,
  parseSavedTrip,
  SAVED_TRIP_KEY,
  stepText,
  tripStep,
  type SavedTrip,
} from "./saved-trip";

const at = (iso: string) => new Date(iso);

/** Fußweg → U79 12:05–12:12 → S6 12:20 (Echtzeit 12:23) – 12:40 */
const TRIP = journey({
  id: "t",
  legs: [
    journeyLeg({
      kind: "walk",
      line: null,
      mode: null,
      durationMinutes: 4,
      origin: journeyStop({ name: "Königsallee 1", plannedDeparture: "2026-11-13T12:01:00Z" }),
      destination: journeyStop({ ...STOP_HBF, plannedArrival: "2026-11-13T12:05:00Z" }),
    }),
    journeyLeg({ line: "U79", mode: "subway" }),
    journeyLeg({
      line: "S6",
      mode: "suburban",
      origin: journeyStop({
        ...STOP_HHA,
        plannedDeparture: "2026-11-13T12:20:00Z",
        realtimeDeparture: "2026-11-13T12:23:00Z",
        platform: "3",
      }),
      destination: journeyStop({ name: "Essen Hbf", plannedArrival: "2026-11-13T12:40:00Z" }),
    }),
  ],
});

describe("Wiedererkennen", () => {
  it("bildet die Signatur aus Fahrten mit Linie und Planabfahrt", () => {
    expect(journeySignature(TRIP)).toBe("U79@2026-11-13T12:05:00Z|S6@2026-11-13T12:20:00Z");
    const other = journey({ id: "o" });
    expect(findJourney([other, { ...TRIP, id: "neu" }], journeySignature(TRIP))?.id).toBe("neu");
    expect(findJourney([other], journeySignature(TRIP))).toBeNull();
  });
});

describe("Nächster Schritt", () => {
  it("führt von Abfahrt über Fahrt und Umstieg bis zur Ankunft", () => {
    expect(tripStep(TRIP, at("2026-11-13T12:00:00Z"))).toMatchObject({ kind: "before" });
    expect(
      stepText(tripStep(TRIP, at("2026-11-13T12:00:00Z")), at("2026-11-13T12:00:00Z")),
    ).toEqual({
      title: "U79 ab Düsseldorf Hbf · Gleis 2",
      when: "Abfahrt in 5 Min",
    });
    const riding = tripStep(TRIP, at("2026-11-13T12:08:00Z"));
    expect(stepText(riding, at("2026-11-13T12:08:00Z"))).toEqual({
      title: "In U79 bis Heinrich-Heine-Allee",
      when: "Ankunft in 4 Min",
    });
    // Umstieg mit Echtzeit: S6 fährt 12:23
    const transfer = tripStep(TRIP, at("2026-11-13T12:15:00Z"));
    expect(stepText(transfer, at("2026-11-13T12:15:00Z"))).toEqual({
      title: "Umsteigen: S6 ab Heinrich-Heine-Allee · Gleis 3",
      when: "Abfahrt in 8 Min",
    });
    expect(tripStep(TRIP, at("2026-11-13T12:45:00Z")).kind).toBe("arrived");
    expect(
      stepText(tripStep(TRIP, at("2026-11-13T12:45:00Z")), at("2026-11-13T12:45:00Z")).title,
    ).toBe("Angekommen");
  });
});

describe("Speicher", () => {
  const trip: SavedTrip = {
    from: { id: STOP_HBF.id, name: "Düsseldorf Hbf" },
    to: { id: "vrr:de:05113:9289", name: "Essen Hbf" },
    options: DEFAULT_JOURNEY_OPTIONS,
    signature: journeySignature(TRIP),
    journey: TRIP,
    savedAt: "2026-11-13T11:59:00Z",
  };

  it("liest gespeicherte Fahrten und verwirft Kaputtes", () => {
    expect(parseSavedTrip(JSON.stringify({ version: 1, ...trip }))).toEqual(trip);
    expect(parseSavedTrip("{kaputt")).toBeNull();
    expect(parseSavedTrip(JSON.stringify({ version: 2, ...trip }))).toBeNull();
    expect(
      parseSavedTrip(JSON.stringify({ version: 1, ...trip, journey: { id: "x" } })),
    ).toBeNull();
    expect(SAVED_TRIP_KEY).toBe("abfahrt:trip");
  });

  it("gilt 30 Minuten nach der Ankunft als vorbei", () => {
    expect(isTripOver(trip, at("2026-11-13T13:05:00Z"))).toBe(false);
    expect(isTripOver(trip, at("2026-11-13T13:11:00Z"))).toBe(true);
  });
});
