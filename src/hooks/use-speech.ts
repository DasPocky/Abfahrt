// Sprachausgabe des Geräts (#129): `speechSynthesis`, deutsche Stimme, nichts verlässt das Gerät.
import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import type { SpeechRate } from "@/lib/settings";

const RATE: Record<SpeechRate, number> = { slow: 0.8, normal: 1, fast: 1.25 };

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/** Deutsche Stimme, lokale bevorzugt; ohne Treffer entscheidet das Gerät */
function germanVoice(s: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith("de"));
  return voices.find((v) => v.localService) ?? voices[0];
}

export function useSpeech() {
  const { speechRate } = useSettings();
  const supported = synth() !== null;
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    synth()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const s = synth();
      if (!s || !text) return;
      s.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = RATE[speechRate];
      const voice = germanVoice(s);
      if (voice) utterance.voice = voice;
      utterance.addEventListener("end", () => setSpeaking(false));
      utterance.addEventListener("error", () => setSpeaking(false));
      setSpeaking(true);
      s.speak(utterance);
    },
    [speechRate],
  );

  // Beim Verlassen der Seite nicht weiterreden
  useEffect(() => () => synth()?.cancel(), []);

  return { supported, speaking, speak, stop };
}
