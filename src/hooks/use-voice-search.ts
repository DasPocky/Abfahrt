// Spracheingabe und Wunsch als Satz (#131, #132): Aufnahme → Whisper (Worker) → Parser → Seite.
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useVoiceRecorder, voiceSupported } from "@/hooks/use-voice-recorder";
import { ApiRequestError, transcribe } from "@/lib/api";
import type { Position } from "@/lib/geo";
import { parseIntent } from "@/lib/intent";
import { intentTarget } from "@/lib/intent-route";

export const VOICE_CONSENT_KEY = "abfahrt:voice-consent";

export function hasVoiceConsent(): boolean {
  try {
    return localStorage.getItem(VOICE_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceConsent(value: boolean): void {
  try {
    if (value) localStorage.setItem(VOICE_CONSENT_KEY, "1");
    else localStorage.removeItem(VOICE_CONSENT_KEY);
  } catch {
    // ohne Speicher gilt die Einwilligung nur bis zum Neuladen
  }
}

export type VoicePhase = "idle" | "consent" | "listening" | "working";

export const VOICE_EXAMPLES =
  "„Abfahrten Heinrich-Heine-Allee“ oder „von Benrath nach Essen Hbf um 8“";

function errorText(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.code === "speech_quota") {
      return "Die Spracherkennung ist für heute ausgelastet. Nutze das Mikrofon deiner Tastatur.";
    }
    if (err.code === "rate_limited") return "Zu viele Aufnahmen, bitte kurz warten.";
  }
  return "Spracherkennung gerade nicht erreichbar. Nutze das Mikrofon deiner Tastatur.";
}

export function useVoiceSearch(position: Position | null) {
  const navigate = useNavigate();
  const { listening, record, stop } = useVoiceRecorder();
  const [phase, setPhase] = useState<VoicePhase>("idle");
  /** Statuszeile: erkannter Text bzw. Hinweis */
  const [message, setMessage] = useState("");

  /** Text verstehen und die passende Seite öffnen; false, wenn nichts zu verstehen war */
  const runText = useCallback(
    async (text: string): Promise<boolean> => {
      const intent = parseIntent(text, new Date());
      if (!intent) {
        setMessage(`Nicht verstanden: „${text}“. Sag zum Beispiel ${VOICE_EXAMPLES}.`);
        return false;
      }
      setPhase("working");
      try {
        const target = await intentTarget(intent, position);
        if (!target.ok) {
          setMessage(target.message);
          return false;
        }
        setMessage("");
        void navigate(target.path, target.state ? { state: target.state } : undefined);
        return true;
      } catch {
        setMessage("Suche gerade nicht möglich.");
        return false;
      } finally {
        setPhase("idle");
      }
    },
    [navigate, position],
  );

  const listen = useCallback(async () => {
    setPhase("listening");
    setMessage("");
    const result = await record();
    if (result.kind !== "audio") {
      setPhase("idle");
      setMessage(
        result.kind === "silence"
          ? "Nichts gehört. Tippe aufs Mikrofon und sprich."
          : result.kind === "denied"
            ? "Das Mikrofon ist nicht erlaubt. Gib es in den Browser-Einstellungen frei."
            : "Aufnahme nicht möglich.",
      );
      return;
    }
    setPhase("working");
    setMessage("Wird erkannt …");
    try {
      const { text } = await transcribe(result.wav);
      if (!text) {
        setPhase("idle");
        setMessage("Nichts verstanden. Bitte noch einmal.");
        return;
      }
      setMessage(`„${text}“`);
      await runText(text);
    } catch (err) {
      setPhase("idle");
      setMessage(errorText(err));
    }
  }, [record, runText]);

  /** Mikrofon-Knopf: beim ersten Mal Einwilligung, während der Aufnahme stoppen */
  const onMic = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    if (phase === "working") return;
    if (!hasVoiceConsent()) {
      setPhase("consent");
      return;
    }
    void listen();
  }, [listen, listening, phase, stop]);

  const acceptConsent = useCallback(() => {
    setVoiceConsent(true);
    void listen();
  }, [listen]);

  const declineConsent = useCallback(() => setPhase("idle"), []);

  return {
    supported: voiceSupported(),
    phase: listening ? "listening" : phase,
    message,
    onMic,
    acceptConsent,
    declineConsent,
    runText,
  };
}
