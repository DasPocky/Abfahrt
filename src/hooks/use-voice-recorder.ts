// Aufnahme für die Spracheingabe (#132): Mikrofon → WAV (16 kHz mono). Endet von selbst nach einer
// Sprechpause, spätestens nach MAX_SECONDS; „stop“ beendet sofort. Der Ton bleibt im Speicher und
// geht nur nach dem Ende an den Server (src/lib/api.ts, transcribe).
import { useCallback, useRef, useState } from "react";
import { concat, downsample, encodeWav, rms } from "@/lib/wav";

export const MAX_SECONDS = 10;
/** So lange still nach dem Sprechen → fertig */
const PAUSE_MS = 1200;
/** So lange ganz ohne Sprache → aufgeben */
const NO_SPEECH_MS = 6000;
const SPEECH_LEVEL = 0.02;
const SILENCE_LEVEL = 0.012;

export type RecordingResult =
  | { kind: "audio"; wav: ArrayBuffer }
  | { kind: "silence" }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "error" };

export function voiceSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.AudioContext === "function"
  );
}

export function useVoiceRecorder() {
  const [listening, setListening] = useState(false);
  const finishRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => finishRef.current?.(), []);

  const record = useCallback(async (): Promise<RecordingResult> => {
    if (!voiceSupported()) return { kind: "unsupported" };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      return err instanceof DOMException && err.name === "NotAllowedError"
        ? { kind: "denied" }
        : { kind: "error" };
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    // ScriptProcessor ist veraltet, läuft aber überall (auch Safari) ohne eigenes Worklet-Skript
    const processor = context.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    const started = performance.now();
    let spokeAt: number | null = null;
    let lastVoice = started;
    setListening(true);

    return new Promise<RecordingResult>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        finishRef.current = null;
        processor.disconnect();
        source.disconnect();
        for (const track of stream.getTracks()) track.stop();
        void context.close();
        setListening(false);
        if (spokeAt === null) {
          resolve({ kind: "silence" });
          return;
        }
        const samples = downsample(concat(chunks), context.sampleRate);
        resolve({ kind: "audio", wav: encodeWav(samples) });
      };
      finishRef.current = finish;

      processor.addEventListener("audioprocess", (event) => {
        const data = new Float32Array(event.inputBuffer.getChannelData(0));
        chunks.push(data);
        const now = performance.now();
        const level = rms(data);
        if (level > SPEECH_LEVEL) {
          spokeAt ??= now;
          lastVoice = now;
        } else if (level > SILENCE_LEVEL) {
          lastVoice = now;
        }
        if (now - started > MAX_SECONDS * 1000) finish();
        else if (spokeAt !== null && now - lastVoice > PAUSE_MS) finish();
        else if (spokeAt === null && now - started > NO_SPEECH_MS) finish();
      });
      source.connect(processor);
      // ohne Verbindung zum Ausgang feuert „audioprocess“ in manchen Browsern nicht (stumm)
      processor.connect(context.destination);
    });
  }, []);

  return { listening, record, stop };
}
