import { describe, expect, it } from "vitest";
import { normalize, parseIntent, resolveTime } from "@/lib/intent";

// Mittwoch, 18.11.2026, 12:00 Uhr Ortszeit des Testlaufs
const NOW = new Date(2026, 10, 18, 12, 0, 0);
const local = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute, 0).toISOString();

describe("normalize", () => {
  it("macht aus Zahlwörtern Ziffern und entfernt Satzzeichen", () => {
    expect(normalize("Von Benrath nach Essen, um acht Uhr.")).toBe(
      "Von Benrath nach Essen um 8 Uhr",
    );
    expect(normalize("um 8.30")).toBe("um 8:30");
  });
});

describe("parseIntent: Verbindungen", () => {
  it.each([
    ["Von Benrath nach Essen Hauptbahnhof.", "Benrath", "Essen Hauptbahnhof"],
    ["von der Heinrich-Heine-Allee zum Hauptbahnhof", "Heinrich-Heine-Allee", "Hauptbahnhof"],
    ["Ich möchte bitte von Düsseldorf Hbf nach Köln fahren", "Düsseldorf Hbf", "Köln"],
    ["nach Essen von Benrath", "Benrath", "Essen"],
    ["Benrath nach Holthausen", "Benrath", "Holthausen"],
    // „Am“ fällt weg, die Suche findet „Am Seestern“ trotzdem
    ["Wie komme ich von Auf der Hardt nach Am Seestern?", "Auf der Hardt", "Seestern"],
  ])("„%s“", (text, from, to) => {
    expect(parseIntent(text, NOW)).toEqual({
      kind: "journey",
      from,
      to,
      time: undefined,
      arrive: false,
    });
  });

  it("nimmt den Standort, wenn nur das Ziel genannt ist", () => {
    expect(parseIntent("Wie komme ich zum Rheinturm?", NOW)).toMatchObject({
      kind: "journey",
      from: null,
      to: "Rheinturm",
    });
    expect(parseIntent("nach Essen Hbf", NOW)).toMatchObject({ from: null, to: "Essen Hbf" });
  });

  it("versteht Uhrzeiten, Tage und Ankunft", () => {
    expect(parseIntent("von Benrath nach Essen um 14 Uhr", NOW)).toMatchObject({
      time: local(18, 14),
      arrive: false,
    });
    expect(parseIntent("von Benrath nach Essen um 14:30", NOW)).toMatchObject({
      time: local(18, 14, 30),
    });
    expect(parseIntent("von Benrath nach Essen um acht", NOW)).toMatchObject({
      time: local(18, 20),
    });
    expect(parseIntent("Morgen um 7 Uhr von Benrath nach Essen", NOW)).toMatchObject({
      time: local(19, 7),
    });
    expect(parseIntent("von Benrath nach Essen halb neun morgen früh", NOW)).toMatchObject({
      time: local(19, 8, 30),
    });
    expect(parseIntent("von Benrath nach Essen, Ankunft um 9", NOW)).toMatchObject({
      time: local(18, 21),
      arrive: true,
    });
    expect(parseIntent("Ich muss bis 18 Uhr in Essen sein, von Benrath", NOW)).toMatchObject({
      from: "Benrath",
      to: "Essen",
      time: local(18, 18),
      arrive: true,
    });
  });
});

describe("parseIntent: Abfahrten", () => {
  it.each([
    ["Abfahrten Heinrich-Heine-Allee", "Heinrich-Heine-Allee", undefined],
    ["Abfahrten an der Heinrich-Heine-Allee.", "Heinrich-Heine-Allee", undefined],
    ["Wann fährt die U79 ab Hauptbahnhof?", "Hauptbahnhof", "U79"],
    ["nächste U 79 ab Hbf", "Hbf", "U79"],
    ["Wann kommt der Bus 782 am Wehrhahn", "Wehrhahn", "782"],
    ["Linie 709 Am Seestern", "Seestern", "709"],
    ["S 6 Düsseldorf Hbf", "Düsseldorf Hbf", "S6"],
    ["Auf der Hardt", "Auf der Hardt", undefined],
  ])("„%s“", (text, stop, line) => {
    const intent = parseIntent(text, NOW);
    expect(intent).toMatchObject({ kind: "departures", stop });
    expect(intent?.kind === "departures" ? intent.line : "x").toBe(line);
  });

  it("mit Uhrzeit", () => {
    expect(parseIntent("Abfahrten Benrath morgen um 6:15", NOW)).toMatchObject({
      kind: "departures",
      stop: "Benrath",
      time: local(19, 6, 15),
    });
  });

  it("gibt null ohne erkennbaren Ort", () => {
    expect(parseIntent("", NOW)).toBeNull();
    expect(parseIntent("Abfahrten", NOW)).toBeNull();
    expect(parseIntent("bitte", NOW)).toBeNull();
  });
});

describe("resolveTime", () => {
  it("nimmt gerade verpasste Zeiten noch für heute, sonst abends oder morgen", () => {
    expect(resolveTime({ hour: 11, minute: 50 }, NOW).toISOString()).toBe(local(18, 11, 50));
    expect(resolveTime({ hour: 9, minute: 0 }, NOW).toISOString()).toBe(local(18, 21));
    expect(resolveTime({ hour: 11, minute: 0, half: "am" }, NOW).toISOString()).toBe(local(19, 11));
    expect(resolveTime({ hour: 1, minute: 0, day: 1 }, NOW).toISOString()).toBe(local(19, 1));
  });
});
