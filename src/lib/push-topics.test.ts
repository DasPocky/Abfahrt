import { describe, expect, it } from "vitest";
import { DEFAULT_JOURNEY_OPTIONS } from "../../shared/journey-options";
import { parsePushTopics, serializePushTopics } from "../../shared/push-topics";
import { journey, journeyLeg, journeyStop } from "../test-utils";
import { toFavorite } from "./favorites";
import { EMPTY_FILTER } from "./filters";
import { buildPushTopics, DEFAULT_PUSH_PREFS, stopTopics, topicsPayload } from "./push-topics";
import type { SavedTrip } from "./saved-trip";

const HHA = { id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U", place: "Düsseldorf" };

describe("Push-Interessen", () => {
  it("nimmt VRR-Favoriten mit den Linien aus ihren Filtern, je Haltestelle einmal", () => {
    const favorites = [
      toFavorite(HHA, { ...EMPTY_FILTER, lines: ["U79"] }),
      toFavorite(HHA, { ...EMPTY_FILTER, lines: ["U75", "U79"] }),
      toFavorite({ id: "transitous:x", name: "Berlin" }, EMPTY_FILTER),
    ];
    expect(stopTopics(favorites)).toEqual([{ id: HHA.id, name: HHA.name, lines: ["U79", "U75"] }]);
  });

  it("baut Interessen mit gemerkter Fahrt, die der Worker so annimmt", () => {
    const j = journey({
      id: "j",
      legs: [
        journeyLeg({
          origin: journeyStop({ name: "A", plannedDeparture: "2026-11-16T10:00:00Z" }),
          destination: journeyStop({ name: "B", plannedArrival: "2026-11-16T10:30:00Z" }),
        }),
      ],
    });
    const trip: SavedTrip = {
      from: { id: HHA.id, name: "Heinrich-Heine-Allee" },
      to: { id: "vrr:de:05113:9289", name: "Essen Hbf" },
      options: DEFAULT_JOURNEY_OPTIONS,
      signature: "U79@2026-11-16T10:00:00Z",
      journey: j,
      savedAt: "2026-11-16T09:00:00Z",
    };
    const topics = buildPushTopics([toFavorite(HHA, EMPTY_FILTER)], trip, DEFAULT_PUSH_PREFS);
    expect(topics.trip).toMatchObject({
      label: "Heinrich-Heine-Allee → Essen Hbf",
      departure: "2026-11-16T10:00:00Z",
      arrival: "2026-11-16T10:30:00Z",
    });
    // gleiches Format wie beim Senden; der Worker-Parser akzeptiert es
    expect(parsePushTopics(JSON.parse(topicsPayload(topics)))).toEqual({
      ...topics,
      trip: {
        ...topics.trip,
        departure: "2026-11-16T10:00:00.000Z",
        arrival: "2026-11-16T10:30:00.000Z",
      },
    });
    expect(serializePushTopics(topics)).toMatchObject({ trip: { options: "" } });
  });

  it("lässt abgeschaltete Bereiche weg", () => {
    const topics = buildPushTopics([toFavorite(HHA, EMPTY_FILTER)], null, {
      alerts: false,
      trip: false,
      quiet: false,
    });
    expect(topics).toEqual({ alerts: false, stops: [], trip: null, quiet: false });
  });
});
