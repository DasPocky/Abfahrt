import { describe, expect, it } from "vitest";
import type { Journey, JourneyLeg, JourneyStop } from "../../shared/api-types";
import {
  departureSentence,
  journeySpeech,
  spokenDelay,
  spokenWhen,
  stopSpeech,
  tripSpeech,
} from "@/lib/speech";
import { departure } from "../test-utils";

const NOW = new Date("2026-11-13T12:00:00Z");
const T = (hhmm: string) => `2026-11-13T${hhmm}:00Z`;

describe("Vorlesen (#129)", () => {
  it("spricht Zeiten und Verspätungen natürlich", () => {
    expect(spokenWhen(new Date(T("12:00")), NOW)).toBe("jetzt");
    expect(spokenWhen(new Date(T("12:01")), NOW)).toBe("in 1 Minute");
    expect(spokenWhen(new Date(T("12:07")), NOW)).toBe("in 7 Minuten");
    expect(spokenWhen(new Date(T("13:05")), NOW)).toMatch(/^um \d\d:05 Uhr$/);
    expect(spokenDelay(null)).toBe("");
    expect(spokenDelay(0)).toBe("pünktlich");
    expect(spokenDelay(1)).toBe("1 Minute später");
    expect(spokenDelay(13)).toBe("13 Minuten später");
    expect(spokenDelay(-2)).toBe("2 Minuten früher");
  });

  it("liest eine Abfahrt mit Verspätung, Gleiswechsel und Ausfall", () => {
    expect(
      departureSentence(
        departure({
          id: "a",
          line: "U76",
          direction: "Holthausen",
          plannedTime: T("12:02"),
          realtimeTime: T("12:04"),
          platform: "4",
          plannedPlatform: null,
        }),
        NOW,
      ),
    ).toBe("U 76 nach Holthausen, in 4 Minuten, 2 Minuten später, Steig 4.");
    expect(
      departureSentence(
        departure({
          id: "b",
          line: "RE5",
          mode: "regional",
          direction: "Koblenz",
          plannedTime: T("12:10"),
          realtimeTime: T("12:10"),
          platform: "9",
          plannedPlatform: "10",
        }),
        NOW,
      ),
    ).toBe("RE 5 nach Koblenz, in 10 Minuten, heute Gleis 9 statt 10.");
    expect(
      departureSentence(
        departure({ id: "c", line: "707", direction: "Unterrath", cancelled: true }),
        NOW,
      ),
    ).toMatch(/^707 nach Unterrath, \d\d:05 Uhr, fällt aus\.$/);
  });

  it("liest die nächsten Abfahrten einer Haltestelle", () => {
    const text = stopSpeech(
      "Heinrich-Heine-Allee",
      [
        departure({
          id: "a",
          line: "U79",
          direction: "Duisburg",
          plannedTime: T("12:03"),
          realtimeTime: T("12:03"),
        }),
      ],
      NOW,
    );
    expect(text).toBe("Abfahrten Heinrich-Heine-Allee. U 79 nach Duisburg, in 3 Minuten, Steig 2.");
    expect(stopSpeech("Hbf", [], NOW)).toBe("Hbf: zurzeit keine Abfahrten.");
  });
});

function stop(name: string, dep: string | null, arr: string | null, platform = "2"): JourneyStop {
  return {
    id: `vrr:de:05111:${name.length}`,
    name,
    plannedArrival: arr,
    realtimeArrival: arr,
    plannedDeparture: dep,
    realtimeDeparture: dep,
    platform,
    plannedPlatform: null,
    cancelled: false,
  };
}

const LEG: JourneyLeg = {
  kind: "transit",
  origin: stop("Krefeld", T("11:50"), null),
  intermediateStops: [
    stop("Bovert", T("11:58"), T("11:58")),
    stop("Heinrich-Heine-Allee", T("12:04"), T("12:04"), "4"),
  ],
  destination: stop("Holthausen", null, T("12:20")),
  durationMinutes: 30,
  distanceMeters: null,
  line: "U76",
  mode: "subway",
  direction: "Holthausen",
  lineColor: null,
  lineTextColor: null,
  cancelled: false,
  notices: [],
  path: null,
};

describe("Vorlesen: Fahrtverlauf und Verbindung", () => {
  it("sagt, wann die Fahrt bei mir ist", () => {
    expect(tripSpeech(LEG, 2, NOW)).toBe(
      "U 76 nach Holthausen. An Heinrich-Heine-Allee in 4 Minuten, pünktlich, Steig 4.",
    );
    expect(tripSpeech(LEG, -1, NOW)).toBe(
      "U 76 nach Holthausen. Nächster Halt Heinrich-Heine-Allee in 4 Minuten, pünktlich, Steig 4.",
    );
    expect(tripSpeech(LEG, 2, new Date(T("12:30")))).toBe(
      "U 76 nach Holthausen. Die Fahrt ist beendet.",
    );
  });

  it("liest eine Verbindung mit Abschnitten", () => {
    const walk: JourneyLeg = {
      ...LEG,
      kind: "walk",
      origin: stop("Holthausen", T("12:20"), T("12:20")),
      destination: stop("Zuhause", null, T("12:25")),
      intermediateStops: [],
      durationMinutes: 5,
      line: null,
      mode: null,
    };
    const journey: Journey = { id: "j", legs: [LEG, walk], transfers: 0, durationMinutes: 35 };
    expect(journeySpeech(journey)).toMatch(
      /^Abfahrt \d\d:50 Uhr, Ankunft \d\d:25 Uhr, 35 Minuten, ohne Umstieg\. U 76 ab Krefeld Steig 2 um \d\d:50 Uhr, Richtung Holthausen, bis Holthausen\. Dann 5 Minuten zu Fuß zu Zuhause\.$/,
    );
  });
});
