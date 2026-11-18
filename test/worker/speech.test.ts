import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_PREFIX } from "../../shared/base-path";
import { resetRateLimit } from "../../worker/rate-limit";
import {
  handleSpeech,
  MAX_AUDIO_BYTES,
  resetSpeechRateLimit,
  type SpeechDeps,
  wavDuration,
} from "../../worker/speech";

/** WAV 16 kHz mono 16 Bit mit `seconds` Stille */
function wav(seconds: number, sampleRate = 16_000): ArrayBuffer {
  const dataBytes = Math.round(seconds * sampleRate) * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  return buffer;
}

function post(body: ArrayBuffer, type = "audio/wav") {
  return new Request(`https://endlab.test${API_PREFIX}speech`, {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });
}

let ipCounter = 0;
const nextIp = () => `10.3.0.${++ipCounter}`;

type Transcribe = (audio: string) => Promise<string>;

function deps(transcribe: Transcribe, dailyMinutes = 120): SpeechDeps {
  return { db: env.PUSH_DB, dailyMinutes, transcribe };
}

beforeEach(async () => {
  await applyD1Migrations(env.PUSH_DB, env.TEST_MIGRATIONS ?? []);
  await env.PUSH_DB.prepare("DELETE FROM speech_usage").run();
  resetSpeechRateLimit();
  resetRateLimit();
});
afterEach(() => vi.restoreAllMocks());

describe("WAV prüfen (#132)", () => {
  it("liest die Dauer aus dem Kopf", () => {
    expect(wavDuration(wav(2))).toBeCloseTo(2, 3);
    expect(wavDuration(wav(0.5, 8_000))).toBeCloseTo(0.5, 3);
  });
  it("lehnt anderes als PCM-WAV ab", () => {
    expect(wavDuration(new ArrayBuffer(10))).toBeNull();
    expect(wavDuration(new Uint8Array(100).fill(120).buffer)).toBeNull();
  });
});

describe("POST /api/speech (#132)", () => {
  it("schickt die Aufnahme als Base64 an die Erkennung und liefert nur den Text", async () => {
    const run = vi.fn<Transcribe>(async () => "  Von Benrath nach Essen Hauptbahnhof.  ");
    const res = await handleSpeech(post(wav(2)), deps(run), nextIp());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Von Benrath nach Essen Hauptbahnhof." });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // Base64 einer WAV beginnt mit „UklGR“ (RIFF)
    expect(run.mock.calls[0]?.[0]).toMatch(/^UklGR/);
    const usage = await env.PUSH_DB.prepare("SELECT seconds, requests FROM speech_usage").first();
    expect(usage).toEqual({ seconds: 2, requests: 1 });
  });

  it("hält die eigene Tagesgrenze ein", async () => {
    const run = vi.fn<Transcribe>(async () => "x");
    // Grenze 1 Minute: 50 s gehen, weitere 12 s nicht mehr
    expect((await handleSpeech(post(wav(10)), deps(run, 1), nextIp())).status).toBe(200);
    for (let i = 0; i < 4; i++) await handleSpeech(post(wav(10)), deps(run, 1), nextIp());
    const res = await handleSpeech(post(wav(12)), deps(run, 1), nextIp());
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "speech_quota" });
    expect(run).toHaveBeenCalledTimes(5);
  });

  it("meldet einen Ausfall von Workers AI (z. B. Kontingent des Kontos erschöpft)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleSpeech(
      post(wav(1)),
      deps(() => Promise.reject(new Error("quota"))),
      nextIp(),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "speech_unavailable" });
    expect(error).toHaveBeenCalledWith("speech", "Error");
  });

  it("prüft Format, Länge und Häufigkeit", async () => {
    const run = vi.fn<Transcribe>(async () => "x");
    const e = deps(run);
    expect((await handleSpeech(post(wav(1), "audio/webm"), e, nextIp())).status).toBe(415);
    expect((await handleSpeech(post(new ArrayBuffer(100)), e, nextIp())).status).toBe(400);
    expect((await handleSpeech(post(wav(0.1)), e, nextIp())).status).toBe(400);
    expect((await handleSpeech(post(wav(20)), e, nextIp())).status).toBe(413);
    expect(MAX_AUDIO_BYTES).toBeLessThan(wav(20).byteLength);
    const ip = nextIp();
    for (let i = 0; i < 6; i++) await handleSpeech(post(wav(1)), e, ip);
    expect((await handleSpeech(post(wav(1)), e, ip)).status).toBe(429);
    expect(run).toHaveBeenCalledTimes(6);
  });

  it("ist per POST erreichbar, andere Methoden nicht", async () => {
    const get = await exports.default.fetch(`https://endlab.test${API_PREFIX}speech`);
    expect(get.status).toBe(405);
    const wrongType = await exports.default.fetch(post(wav(1), "text/plain"));
    expect(wrongType.status).toBe(415);
  });
});
