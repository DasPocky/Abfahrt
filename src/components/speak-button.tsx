import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-speech";

/**
 * „Vorlesen“ (#129): liest den Text mit der Sprachausgabe des Geräts vor, erneut tippen stoppt.
 * `text` wird erst beim Tippen gebildet, damit er die aktuellen Minuten enthält.
 * `pill`: kleine Schaltfläche mit Text (Verbindungsdetails), sonst nur Symbol.
 */
export function SpeakButton({
  text,
  label = "Vorlesen",
  pill = false,
  size = "icon",
}: {
  text: () => string;
  label?: string;
  pill?: boolean;
  size?: "icon" | "icon-sm";
}) {
  const { supported, speaking, speak, stop } = useSpeech();
  if (!supported) return null;
  const onClick = () => (speaking ? stop() : speak(text()));
  const icon = speaking ? (
    <Square className="size-3.5 shrink-0" aria-hidden="true" />
  ) : (
    <Volume2 className="size-3.5 shrink-0" aria-hidden="true" />
  );
  if (pill) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={speaking}
        className="inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2.5 font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon}
        {speaking ? "Stopp" : "Vorlesen"}
      </button>
    );
  }
  return (
    <Button
      variant={size === "icon" ? "outline" : "ghost"}
      size={size}
      aria-label={speaking ? "Vorlesen stoppen" : label}
      aria-pressed={speaking}
      onClick={onClick}
    >
      {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </Button>
  );
}
