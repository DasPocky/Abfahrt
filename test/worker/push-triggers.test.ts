import { applyD1Migrations, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert, Journey, JourneyLeg, JourneyStop } from "../../shared/api-types";
import { API_PREFIX } from "../../shared/base-path";
import { DEFAULT_JOURNEY_OPTIONS } from "../../shared/journey-options";
import { serializePushTopics, type PushTopics, type PushTripTopic } from "../../shared/push-topics";
import { journeySignature } from "../../shared/transfers";
import { runPushCron } from "../../worker/push/cron";
import { checkAlerts, checkTrip, isQuietTime, tripActive } from "../../worker/push/triggers";
import { resetRateLimit } from "../../worker/rate-limit";
import addinfo from "./fixtures/vrr-addinfo-duesseldorf.json";

function stop(name: string, over: Partial<JourneyStop> = {}): JourneyStop {
  return {
    id: null,
    name,
    plannedArrival: null,
    realtimeArrival: null,
    plannedDeparture: null,
    realtimeDeparture: null,
    platform: null,
    plannedPlatform: null,
    cancelled: false,
    ...over,
  };
}

function leg(over: Partial<JourneyLeg>): JourneyLeg {
  return {
    kind: "transit",
    origin: stop("A"),
    destination: stop("B"),
    durationMinutes: 10,
    distanceMeters: null,
    line: "U76",
    mode: "subway",
    direction: null,
    lineColor: null,
    lineTextColor: null,
    intermediateStops: [],
    cancelled: false,
    notices: [],
    path: null,
    ...over,
  };
}

/** U76 10:00–10:16, Umstieg, S6 10:20–11:00 (Echtzeit optional) */
function journey(u76Delay = 0, s6Departure = "2026-11-16T10:20:00Z"): Journey {
  return {
    id: "j",
    transfers: 1,
    durationMinutes: 60,
    legs: [
      leg({
        origin: stop("Holthausen", {
          plannedDeparture: "2026-11-16T10:00:00Z",
          realtimeDeparture: new Date(
            Date.parse("2026-11-16T10:00:00Z") + u76Delay * 60_000,
          ).toISOString(),
        }),
        destination: stop("Düsseldorf Hbf", {
          plannedArrival: "2026-11-16T10:16:00Z",
          realtimeArrival: new Date(
            Date.parse("2026-11-16T10:16:00Z") + u76Delay * 60_000,
          ).toISOString(),
        }),
      }),
      leg({
        line: "S6",
        mode: "suburban",
        origin: stop("Düsseldorf Hbf", {
          plannedDeparture: "2026-11-16T10:20:00Z",
          realtimeDeparture: s6Departure,
        }),
        destination: stop("Essen Hbf", { plannedArrival: "2026-11-16T11:00:00Z" }),
      }),
    ],
  };
}

const TRIP: PushTripTopic = {
  from: "vrr:de:05111:18266",
  to: "vrr:de:05113:9289",
  label: "Holthausen → Essen Hbf",
  options: DEFAULT_JOURNEY_OPTIONS,
  signature: journeySignature(journey()),
  departure: "2026-11-16T10:00:00.000Z",
  arrival: "2026-11-16T11:00:00.000Z",
};

function alert(id: string, title: string, lines: string[] = []): Alert {
  return {
    id,
    kind: "info",
    severity: "normal",
    title,
    text: "",
    url: null,
    validFrom: null,
    validTo: null,
    lines: lines.map((line) => ({ line, mode: "subway" })),
    stops: [],
  };
}

describe("Störungen: was ist neu?", () => {
  it("erfasst beim ersten Mal nur, ohne zu melden", () => {
    const first = checkAlerts([alert("a", "Alt")], null);
    expect(first).toEqual({ messages: [], seen: ["a"] });
  });

  it("meldet neue Meldungen einzeln bzw. gesammelt", () => {
    const one = checkAlerts([alert("a", "Alt"), alert("b", "Aufzug defekt", ["U79"])], ["a"]);
    expect(one.messages).toEqual([
      { title: "Störung: U79", body: "Aufzug defekt", url: "/stoerungen", tag: "alerts" },
    ]);
    expect(one.seen).toEqual(["a", "b"]);
    const many = checkAlerts([alert("c", "Eins"), alert("d", "Zwei")], ["a"]);
    expect(many.messages[0]?.title).toBe("2 neue Störungen bei deinen Favoriten");
    // nicht mehr aktuelle IDs fallen aus der Liste
    expect(many.seen).toEqual(["c", "d"]);
    expect(checkAlerts([alert("c", "Eins")], ["c"]).messages).toEqual([]);
  });

  it("kennt die Ruhezeit 22–6 Uhr (Berlin)", () => {
    expect(isQuietTime(new Date("2026-11-16T21:30:00Z"))).toBe(true); // 22:30
    expect(isQuietTime(new Date("2026-11-16T04:30:00Z"))).toBe(true); // 05:30
    expect(isQuietTime(new Date("2026-11-16T05:30:00Z"))).toBe(false); // 06:30
  });
});

describe("Gemerkte Fahrt: was hat sich geändert?", () => {
  it("begleitet ab 60 Minuten vor der Abfahrt bis kurz nach der Ankunft", () => {
    expect(tripActive(TRIP, new Date("2026-11-16T08:59:00Z"))).toBe(false);
    expect(tripActive(TRIP, new Date("2026-11-16T09:00:00Z"))).toBe(true);
    expect(tripActive(TRIP, new Date("2026-11-16T11:11:00Z"))).toBe(false);
  });

  it("meldet Verspätung ab 5 Minuten, erneut erst bei 3 Minuten Änderung", () => {
    // S6 später, damit der Umstieg reicht
    expect(checkTrip(TRIP, journey(3, "2026-11-16T10:30:00Z"), {}).messages).toEqual([]);
    const late = checkTrip(TRIP, journey(6, "2026-11-16T10:30:00Z"), {});
    expect(late.messages.map((m) => m.title)).toEqual(["U76 +6 Min"]);
    expect(checkTrip(TRIP, journey(7, "2026-11-16T10:30:00Z"), late.state).messages).toEqual([]);
    expect(checkTrip(TRIP, journey(9, "2026-11-16T10:30:00Z"), late.state).messages[0]?.title).toBe(
      "U76 +9 Min",
    );
  });

  it("meldet gefährdete Anschlüsse, Ausfall und verschwundene Verbindung je einmal", () => {
    // U76 +5 kommt 10:21 an, S6 fährt 10:20: nicht erreichbar
    const missed = checkTrip(TRIP, journey(5), {});
    expect(missed.messages.map((m) => m.title)).toEqual([
      "Anschluss nicht erreichbar",
      "U76 +5 Min",
    ]);
    expect(checkTrip(TRIP, journey(5), missed.state).messages).toEqual([]);

    const gone = checkTrip(TRIP, null, {});
    expect(gone.messages[0]?.title).toBe("Verbindung nicht mehr im Fahrplan");
    expect(checkTrip(TRIP, null, gone.state).messages).toEqual([]);

    const cancelledJourney = journey();
    cancelledJourney.legs[1] = { ...cancelledJourney.legs[1]!, cancelled: true };
    expect(checkTrip(TRIP, cancelledJourney, {}).messages[0]?.title).toBe("Fahrt fällt aus");
  });

  it("fängt bei einer anderen gemerkten Verbindung neu an", () => {
    const state = checkTrip(TRIP, null, {}).state;
    const other = { ...TRIP, signature: "S1@x" };
    expect(checkTrip(other, null, state).messages).toHaveLength(1);
  });
});

// ---- Endpoint und Cron mit lokaler D1 ----

const API = `https://endlab.test${API_PREFIX}`;
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/trigger-test";

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function subscription() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  if (!("publicKey" in pair)) throw new Error("Schlüsselpaar erwartet");
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  if (!(raw instanceof ArrayBuffer)) throw new Error("ArrayBuffer erwartet");
  return {
    endpoint: ENDPOINT,
    keys: {
      p256dh: b64(new Uint8Array(raw)),
      auth: b64(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

let ip = 0;
function postTopics(sub: unknown, topics: unknown) {
  return exports.default.fetch(`${API}push/topics`, {
    method: "POST",
    headers: {
      "CF-Connecting-IP": `10.4.0.${++ip}`,
      "Content-Type": "application/json",
      Origin: "https://endlab.test",
    },
    body: JSON.stringify({ subscription: sub, topics }),
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.PUSH_DB, env.TEST_MIGRATIONS ?? []);
});
beforeEach(() => resetRateLimit());
afterEach(() => vi.restoreAllMocks());

describe("Push-Interessen und Cron", () => {
  const topics: PushTopics = {
    alerts: true,
    stops: [{ id: "vrr:de:05111:18036", name: "Heinrich-Heine-Allee U", lines: ["U79"] }],
    trip: null,
    quiet: false,
  };

  it("speichert Interessen und lehnt Ungültiges ab", async () => {
    const sub = await subscription();
    expect((await postTopics(sub, serializePushTopics(topics))).status).toBe(200);
    const row = await env.PUSH_DB.prepare(
      "SELECT topics FROM push_subscriptions WHERE endpoint = ?1",
    )
      .bind(ENDPOINT)
      .first<{ topics: string }>();
    expect(JSON.parse(row?.topics ?? "{}")).toMatchObject({
      alerts: true,
      stops: [{ lines: ["U79"] }],
    });
    expect(
      (await postTopics(sub, { ...topics, stops: [{ id: "x", name: "y", lines: [] }] })).status,
    ).toBe(400);
    expect((await postTopics(sub, { alerts: "ja" })).status).toBe(400);
  });

  it("erfasst beim ersten Lauf, meldet danach nur neue Störungen", async () => {
    const sub = await subscription();
    await postTopics(sub, serializePushTopics(topics));
    // Erster Lauf: VRR liefert die Meldungen ohne die Nordstraße-Meldung (U79), nichts senden
    const current = addinfo.infos.current;
    const withoutU79 = {
      infos: { current: current.filter((i) => !JSON.stringify(i).includes("U79")) },
    };
    const pushes: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("XML_ADDINFO_REQUEST")) return Response.json(withoutU79);
      if (url.startsWith("https://fcm.googleapis.com")) {
        pushes.push(url);
        return new Response(null, { status: 201 });
      }
      return new Response("unerwartet", { status: 500 });
    });
    const ctx1 = createExecutionContext();
    expect(await runPushCron(env, ctx1, new Date("2026-11-16T12:00:00Z"))).toEqual({ sent: 0 });
    await waitOnExecutionContext(ctx1);
    vi.restoreAllMocks();

    // Zweiter Lauf (Cache umgehen: neue Minute reicht nicht, daher anderer Zeitpunkt + leerer Cache)
    await caches.default.delete(
      new Request("https://abfahrt.endlab.de/api/__cache/alerts%3Av2%3A5111000"),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("XML_ADDINFO_REQUEST")) return Response.json(addinfo);
      if (url.startsWith("https://fcm.googleapis.com")) {
        pushes.push(url);
        return new Response(null, { status: 201 });
      }
      return new Response("unerwartet", { status: 500 });
    });
    const ctx2 = createExecutionContext();
    expect(await runPushCron(env, ctx2, new Date("2026-11-16T12:05:00Z"))).toEqual({ sent: 1 });
    await waitOnExecutionContext(ctx2);
    expect(pushes).toEqual([ENDPOINT]);
  });
});
