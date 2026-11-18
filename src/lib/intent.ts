// Wunsch als Satz (#131): „von Benrath nach Essen Hbf um 8“, „Abfahrten Heinrich-Heine-Allee“,
// „nächste U79 ab Hauptbahnhof“. Regeln statt KI, läuft im Browser. Rein und getestet.

export interface DeparturesIntent {
  kind: "departures";
  stop: string;
  /** Linie, z. B. „U79“, „S6“, „RE5“, „782“ */
  line?: string;
  /** ISO-8601 */
  time?: string;
}

export interface JourneyIntent {
  kind: "journey";
  /** null = vom aktuellen Standort */
  from: string | null;
  to: string;
  /** ISO-8601 */
  time?: string;
  /** `time` ist die gewünschte Ankunft */
  arrive: boolean;
}

export type Intent = DeparturesIntent | JourneyIntent;

const NUMBER_WORDS: Record<string, number> = {
  null: 0,
  eins: 1,
  ein: 1,
  eine: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  einundzwanzig: 21,
  zweiundzwanzig: 22,
  dreiundzwanzig: 23,
  dreißig: 30,
  fünfundvierzig: 45,
};

/** Zahlwörter → Ziffern, Satzzeichen weg, Leerraum vereinheitlichen */
export function normalize(text: string): string {
  return text
    .replace(/[„“"!?¿;]/g, " ")
    .replace(/(\d)\.(\d{2})\b/g, "$1:$2")
    .replace(/[.,]+(\s|$)/g, " ")
    .split(/\s+/)
    .map((word) => {
      const n = NUMBER_WORDS[word.toLowerCase()];
      return n === undefined ? word : String(n);
    })
    .join(" ")
    .trim();
}

interface TimeParts {
  hour: number;
  minute: number;
  /** 0 heute, 1 morgen, 2 übermorgen; undefined = nicht gesagt */
  day?: number;
  /** „morgens“, „abends“ … */
  half?: "am" | "pm";
}

interface Extracted {
  rest: string;
  time?: TimeParts;
  /** Tag ohne Uhrzeit („morgen“) */
  day?: number;
  arrive: boolean;
}

/** Zeit-, Tages- und Ankunftsangaben finden und aus dem Satz entfernen */
function extractTime(input: string): Extracted {
  let text = ` ${input} `;
  let arrive = false;
  let day: number | undefined;
  let half: TimeParts["half"];
  let hour: number | undefined;
  let minute = 0;

  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const m = re.exec(text);
    if (!m) return;
    fn(m);
    text = text.replace(m[0], " ");
  };

  take(/\s(übermorgen)\s/i, () => (day = 2));
  take(/\s(morgen)(\s+früh)?\s/i, (m) => {
    day = 1;
    if (m[2]) half = "am";
  });
  take(/\s(heute)\s/i, () => (day = 0));
  take(/\s(morgens|vormittags|früh)\s/i, () => (half = "am"));
  take(/\s(nachmittags|abends|nachts)\s/i, () => (half = "pm"));
  take(/\s(ankunft|ankommen|da sein|dort sein|sein)\s/i, () => (arrive = true));

  const prefix = String.raw`(?:um|ab|gegen|bis|für|an)?\s*`;
  take(new RegExp(String.raw`\s${prefix}halb\s+(\d{1,2})\s`, "i"), (m) => {
    hour = Number(m[1]) - 1;
    minute = 30;
  });
  take(new RegExp(String.raw`\s${prefix}viertel\s+nach\s+(\d{1,2})\s`, "i"), (m) => {
    hour = Number(m[1]);
    minute = 15;
  });
  take(new RegExp(String.raw`\s${prefix}viertel\s+vor\s+(\d{1,2})\s`, "i"), (m) => {
    hour = Number(m[1]) - 1;
    minute = 45;
  });
  if (hour === undefined) {
    take(/\s(um|ab|gegen|bis|an)\s+(\d{1,2})(?::(\d{2})|\s*uhr(?:\s+(\d{1,2}))?)?\s/i, (m) => {
      if (m[1]?.toLowerCase() === "bis") arrive = true;
      hour = Number(m[2]);
      minute = Number(m[3] ?? m[4] ?? 0);
    });
  }
  if (hour === undefined) {
    take(/\s(\d{1,2})(?::(\d{2})|\s*uhr(?:\s+(\d{1,2}))?)\s/i, (m) => {
      hour = Number(m[1]);
      minute = Number(m[2] ?? m[3] ?? 0);
    });
  }
  take(/\s(ankunft|an)\s*$/i, () => (arrive = true));

  const valid = hour !== undefined && hour >= 0 && hour <= 24 && minute >= 0 && minute < 60;
  return {
    rest: text.replace(/\s+/g, " ").trim(),
    time: valid && hour !== undefined ? { hour: hour % 24, minute, day, half } : undefined,
    day,
    arrive,
  };
}

/**
 * Uhrzeit → Zeitpunkt in der Zeitzone des Geräts. Ohne Tag: heute; ist die Zeit schon vorbei,
 * zuerst dieselbe Uhrzeit am Abend („um 8“ mittags → 20 Uhr), sonst morgen.
 */
export function resolveTime(t: TimeParts, now: Date): Date {
  const at = (hour: number, dayOffset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, t.minute, 0, 0);
    return d;
  };
  let hour = t.hour;
  if (t.half === "pm" && hour < 12) hour += 12;
  if (t.half === "am" && hour === 12) hour = 0;
  if (t.day !== undefined) return at(hour, t.day);
  const today = at(hour, 0);
  // bis 15 Minuten zurück gilt noch als „heute“ (gerade verpasst)
  if (today.getTime() >= now.getTime() - 15 * 60_000) return today;
  if (t.half === undefined && hour < 12) {
    const evening = at(hour + 12, 0);
    if (evening.getTime() >= now.getTime()) return evening;
  }
  return at(hour, 1);
}

const FILLER =
  /\b(bitte|mal|doch|ich\s+(?:möchte|will|muss|würde\s+gern|würde\s+gerne)|zeig(?:e)?\s+mir|such(?:e)?|finde|wie\s+komme\s+ich|wie\s+kommt\s+man|komme\s+ich|kann\s+ich|eine?n?\s+verbindung|die\s+verbindung|verbindung(?:en)?|route|fahrt|fahren|jetzt|sofort|gleich|als\s+nächstes)\b/gi;

const LEADING = new Set([
  "der",
  "die",
  "das",
  "dem",
  "den",
  "zum",
  "zur",
  "zu",
  "vom",
  "von",
  "am",
  "an",
  "ab",
  "in",
  "im",
  "bei",
  "für",
  "haltestelle",
  "station",
]);
const TRAILING = new Set(["aus", "los", "weg", "an", "ab", "bitte"]);

/** Artikel und Präpositionen nur am Anfang bzw. Ende eines Ortsnamens weg („Auf der Hardt“ bleibt) */
function cleanPlace(raw: string): string {
  const words = raw.split(/\s+/).filter(Boolean);
  while (words.length > 1 && LEADING.has(words[0]!.toLowerCase())) words.shift();
  while (words.length > 1 && TRAILING.has(words.at(-1)!.toLowerCase())) words.pop();
  if (words.length === 1 && LEADING.has(words[0]!.toLowerCase())) return "";
  return words.join(" ");
}

const LINE =
  /\b(?:(u|s|re|rb|ice|ic|ec|sb|ne)\s?-?(\d{1,4})|(?:linie|bus|tram|straßenbahn|buslinie)\s+([a-z]{0,2}\s?\d{1,4}))\b/i;

function extractLine(text: string): { rest: string; line?: string } {
  const m = LINE.exec(text);
  if (!m) return { rest: text };
  const line = m[1]
    ? `${m[1].toUpperCase()}${m[2]}`
    : (m[3] ?? "").replace(/\s/g, "").toUpperCase();
  return { rest: text.replace(m[0], " ").replace(/\s+/g, " ").trim(), line };
}

function toIso(t: TimeParts | undefined, now: Date): string | undefined {
  return t ? resolveTime(t, now).toISOString() : undefined;
}

/** Versteht einen Wunsch; null, wenn kein Ort erkennbar ist */
export function parseIntent(input: string, now: Date): Intent | null {
  const normalized = normalize(input);
  if (!normalized) return null;
  const extracted = extractTime(normalized);
  const { rest: withoutTime, arrive } = extracted;
  // „morgen“ ohne Uhrzeit: morgen zur selben Uhrzeit
  const time =
    extracted.time ??
    (extracted.day !== undefined
      ? { hour: now.getHours(), minute: now.getMinutes(), day: extracted.day }
      : undefined);
  const text = withoutTime.replace(FILLER, " ").replace(/\s+/g, " ").trim();

  // Verbindung: „von A nach B“, „nach B von A“, „A nach B“, „nach B“, „zum B“
  const journey = /(?:^|\s)von\s+(.+?)\s+(?:nach|zum|zur|zu|bis)\s+(.+)$/i.exec(text) ?? null;
  if (journey) {
    const from = cleanPlace(journey[1] ?? "");
    const to = cleanPlace(journey[2] ?? "");
    if (from && to) return { kind: "journey", from, to, time: toIso(time, now), arrive };
  }
  const reverse = /(?:^|\s)(?:nach|zum|zur)\s+(.+?)\s+von\s+(.+)$/i.exec(text);
  if (reverse) {
    const to = cleanPlace(reverse[1] ?? "");
    const from = cleanPlace(reverse[2] ?? "");
    if (from && to) return { kind: "journey", from, to, time: toIso(time, now), arrive };
  }
  // „(bis 18 Uhr) in Essen sein, von Benrath“
  if (arrive) {
    const inFrom = /(?:^|\s)in\s+(.+?)\s+von\s+(.+)$/i.exec(text);
    if (inFrom) {
      const to = cleanPlace(inFrom[1] ?? "");
      const from = cleanPlace(inFrom[2] ?? "");
      if (from && to) return { kind: "journey", from, to, time: toIso(time, now), arrive };
    }
    const inOnly = /(?:^|\s)in\s+(.+)$/i.exec(text);
    if (inOnly) {
      const to = cleanPlace(inOnly[1] ?? "");
      if (to) return { kind: "journey", from: null, to, time: toIso(time, now), arrive };
    }
  }
  const isDepartures =
    /\b(abfahrt(?:en)?|abfahrtszeiten|wann\s+fährt|wann\s+kommt|nächste[nr]?|monitor|anzeigetafel)\b/i.test(
      text,
    );
  if (!isDepartures) {
    const plain = /^(.+?)\s+nach\s+(.+)$/i.exec(text);
    if (plain) {
      const from = cleanPlace(plain[1] ?? "");
      const to = cleanPlace(plain[2] ?? "");
      if (from && to) return { kind: "journey", from, to, time: toIso(time, now), arrive };
    }
    const toOnly = /(?:^|\s)(?:nach|zum|zur|zu)\s+(.+)$/i.exec(text);
    if (toOnly) {
      const to = cleanPlace(toOnly[1] ?? "");
      if (to) return { kind: "journey", from: null, to, time: toIso(time, now), arrive };
    }
  }

  // Abfahrten: „Abfahrten Heinrich-Heine-Allee“, „wann fährt die U79 ab Hbf“, „Hbf“
  const { rest, line } = extractLine(text);
  const stopText = rest
    .replace(
      /(^|\s)(abfahrt(?:en)?|abfahrtszeiten|wann\s+fährt|wann\s+kommt|nächste[nr]?|monitor|anzeigetafel|zeiten)(?=\s|$)/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const stop = cleanPlace(stopText);
  if (!stop) return null;
  const intent: DeparturesIntent = { kind: "departures", stop };
  if (line) intent.line = line;
  const iso = toIso(time, now);
  if (iso) intent.time = iso;
  return intent;
}
