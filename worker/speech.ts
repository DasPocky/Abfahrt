// Spracheingabe (#132): `POST /api/speech` mit einer kurzen WAV-Aufnahme → erkannter Text.
// Whisper über Workers AI. Der Ton wird weder gespeichert noch protokolliert; gezählt werden nur
// Sekunden je Tag (eigene Tagesgrenze, das freie Kontingent gilt fürs ganze Konto).
import type { SpeechResponse } from "../shared/api-types";
import { apiError, json } from "./http";

export const SPEECH_MODEL = "@cf/openai/whisper-large-v3-turbo";
/** ~12 s bei 16 kHz, mono, 16 Bit (32 KB/s) plus Kopf */
export const MAX_AUDIO_BYTES = 400_000;
export const MAX_AUDIO_SECONDS = 12;
const MIN_AUDIO_SECONDS = 0.3;
/** Eigenes Limit je IP zusätzlich zum allgemeinen Rate-Limit */
const SPEECH_PER_MINUTE = 6;
const MAX_TEXT_LENGTH = 300;

/** Hilft Whisper bei Haltestellen und Linien (Kontext, kein Befehl) */
const INITIAL_PROMPT =
  "Abfahrten Heinrich-Heine-Allee. Von Benrath nach Essen Hauptbahnhof um 8 Uhr. Nächste U79 ab Düsseldorf Hbf. S6, RE1, Bus 782, Straßenbahn 709.";

const hits = new Map<string, { start: number; count: number }>();

export function isSpeechRateLimited(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip);
  if (!entry || now - entry.start >= 60_000) {
    if (hits.size >= 5_000) hits.clear();
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > SPEECH_PER_MINUTE;
}

export function resetSpeechRateLimit(): void {
  hits.clear();
}

/** Dauer einer PCM-WAV-Datei in Sekunden; null, wenn es keine gültige WAV ist */
export function wavDuration(buffer: ArrayBuffer): number | null {
  if (buffer.byteLength < 44) return null;
  const view = new DataView(buffer);
  const tag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") {
      if (offset + 20 > buffer.byteLength || view.getUint16(offset + 8, true) !== 1) return null;
      byteRate = view.getUint32(offset + 16, true);
    } else if (id === "data") {
      if (byteRate <= 0) return null;
      const dataBytes = Math.min(size, buffer.byteLength - offset - 8);
      return dataBytes / byteRate;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function usedSeconds(db: D1Database, day: string): Promise<number> {
  const row = await db
    .prepare("SELECT seconds FROM speech_usage WHERE day = ?1")
    .bind(day)
    .first<{ seconds: number }>();
  return row?.seconds ?? 0;
}

async function addUsage(db: D1Database, day: string, seconds: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO speech_usage (day, seconds, requests) VALUES (?1, ?2, 1)
       ON CONFLICT(day) DO UPDATE SET seconds = seconds + ?2, requests = requests + 1`,
    )
    .bind(day, seconds)
    .run();
}

/** Abhängigkeiten, in Tests ersetzbar */
export interface SpeechDeps {
  db: D1Database;
  /** Audio-Minuten je Tag für Abfahrt */
  dailyMinutes: number;
  /** WAV als Base64 → erkannter Text */
  transcribe: (audioBase64: string) => Promise<string>;
}

/** Whisper über Workers AI */
export function workersAiTranscriber(ai: Ai): SpeechDeps["transcribe"] {
  return async (audio) => {
    const result = await ai.run(SPEECH_MODEL, {
      audio,
      language: "de",
      vad_filter: true,
      initial_prompt: INITIAL_PROMPT,
    });
    return result.text ?? "";
  };
}

export async function handleSpeech(
  request: Request,
  deps: SpeechDeps,
  ip: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.startsWith("audio/wav") && !type.startsWith("audio/x-wav")) {
    return apiError(415, "unsupported_audio", "Nur WAV-Aufnahmen");
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_AUDIO_BYTES) return apiError(413, "audio_too_large", "Aufnahme zu lang");
  if (isSpeechRateLimited(ip)) {
    return apiError(429, "rate_limited", "Zu viele Aufnahmen, bitte kurz warten");
  }

  const audio = await request.arrayBuffer();
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return apiError(413, "audio_too_large", "Aufnahme zu lang");
  }
  const seconds = wavDuration(audio);
  if (seconds === null) return apiError(400, "invalid_audio", "Keine gültige WAV-Aufnahme");
  if (seconds < MIN_AUDIO_SECONDS || seconds > MAX_AUDIO_SECONDS + 0.5) {
    return apiError(400, "invalid_audio_length", "Aufnahme zu kurz oder zu lang");
  }

  const day = today();
  if ((await usedSeconds(deps.db, day)) + seconds > deps.dailyMinutes * 60) {
    return apiError(429, "speech_quota", "Spracherkennung für heute ausgelastet");
  }

  let text: string;
  try {
    text = (await deps.transcribe(toBase64(audio))).trim().slice(0, MAX_TEXT_LENGTH);
  } catch (err) {
    // ohne Inhalt protokollieren: nur, dass es fehlschlug (z. B. Kontingent des Kontos erschöpft)
    console.error("speech", err instanceof Error ? err.name : "Fehler");
    return apiError(503, "speech_unavailable", "Spracherkennung gerade nicht verfügbar");
  }
  // Abgerechnet wird je Audio-Minute; ganze Sekunden zählen (eher zu viel als zu wenig)
  await addUsage(deps.db, day, Math.ceil(seconds));

  const body: SpeechResponse = { text };
  return json(body, { headers: { "Cache-Control": "no-store" } });
}
