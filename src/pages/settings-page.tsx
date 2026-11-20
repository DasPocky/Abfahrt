// Einstellungen (#37): Darstellung der Abfahrtszeile, Hell/Dunkel, Abfahrten je Favorit.
import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "cn";
import { DepartureList } from "@/components/departure-list";
import { Segmented } from "@/components/segmented";
import { SpeakButton } from "@/components/speak-button";
import { Button } from "@/components/ui/button";
import { useRecentPlaces } from "@/hooks/use-recent-places";
import { useSettings } from "@/hooks/use-settings";
import { hasVoiceConsent, setVoiceConsent } from "@/hooks/use-voice-search";
import { clearRecent } from "@/lib/recent-places";
import {
  FAVORITE_COUNTS,
  ROW_STYLES,
  SPEECH_RATES,
  setSettings,
  type SpeechRate,
  type RowStyle,
  type ThemeChoice,
} from "@/lib/settings";
import type { Departure } from "../../shared/api-types";
import { usePageTitle } from "@/hooks/use-page-title";

const ROW_STYLE_LABEL: Record<RowStyle, { title: string; text: string }> = {
  a: { title: "Linie vorn", text: "Linie mit Symbol, Ziel, Minuten rechts (Standard)" },
  b: { title: "Anzeigetafel", text: "Große Minuten vorn, Gleis rechts" },
  c: { title: "Karten", text: "Jede Abfahrt als Karte mit Farbstreifen der Linie" },
};

const SPEECH_RATE_LABEL: Record<SpeechRate, string> = {
  slow: "Langsam",
  normal: "Normal",
  fast: "Schnell",
};

const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Wie System" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/** Feste Beispiel-Abfahrten für die Vorschau (relativ zu einem festen Zeitpunkt) */
const PREVIEW_NOW = new Date("2026-11-17T12:00:00Z");
const PREVIEW: Departure[] = [
  {
    id: "p1",
    line: "U76",
    mode: "subway",
    direction: "Holthausen",
    plannedTime: "2026-11-17T12:03:00Z",
    realtimeTime: "2026-11-17T12:05:00Z",
    platform: "4",
    plannedPlatform: null,
    cancelled: false,
    lineColor: null,
    lineTextColor: null,
    notices: [],
  },
  {
    id: "p2",
    line: "709",
    mode: "tram",
    direction: "Neuss Theodor-Heuss-Platz",
    plannedTime: "2026-11-17T12:08:00Z",
    realtimeTime: "2026-11-17T12:08:00Z",
    platform: "3",
    plannedPlatform: null,
    cancelled: false,
    lineColor: null,
    lineTextColor: null,
    notices: [],
  },
];

export function SettingsPage() {
  usePageTitle("Einstellungen");
  const settings = useSettings();
  const [voiceConsent, setVoiceConsentState] = useState(hasVoiceConsent);
  const recent = useRecentPlaces();
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
        <Link to="/mehr" aria-label="Zurück zu Mehr">
          <ArrowLeft aria-hidden="true" />
          Mehr
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>

      <section aria-labelledby="settings-rows" className="space-y-2">
        <h2 id="settings-rows" className="text-lg font-semibold tracking-tight">
          Darstellung der Abfahrten
        </h2>
        <div role="radiogroup" aria-labelledby="settings-rows" className="space-y-3">
          {ROW_STYLES.map((style) => {
            const active = settings.rowStyle === style;
            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSettings({ ...settings, rowStyle: style })}
                className={cn(
                  "block w-full rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      active && "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {active && <Check className="size-3.5" />}
                  </span>
                  <span className="font-medium">{ROW_STYLE_LABEL[style].title}</span>
                </span>
                <span className="mt-0.5 block pl-7 text-xs text-muted-foreground">
                  {ROW_STYLE_LABEL[style].text}
                </span>
                {/* Vorschau mit Beispiel-Abfahrten; nicht bedienbar */}
                <span className="pointer-events-none mt-2 block pl-7" aria-hidden="true" inert>
                  <DepartureList departures={PREVIEW} now={PREVIEW_NOW} rowStyle={style} compact />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="settings-theme" className="space-y-2">
        <h2 id="settings-theme" className="text-lg font-semibold tracking-tight">
          Erscheinungsbild
        </h2>
        <Segmented
          choices={THEME_CHOICES}
          value={settings.theme}
          onChange={(theme) => setSettings({ ...settings, theme })}
        />
      </section>

      <section aria-labelledby="settings-favorites" className="space-y-2">
        <h2 id="settings-favorites" className="text-lg font-semibold tracking-tight">
          Abfahrten je Favorit
        </h2>
        <Segmented
          choices={FAVORITE_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          value={settings.favoriteCount}
          onChange={(favoriteCount) => setSettings({ ...settings, favoriteCount })}
        />
      </section>

      <section aria-labelledby="settings-speech" className="space-y-2">
        <h2 id="settings-speech" className="text-lg font-semibold tracking-tight">
          Vorlesen
        </h2>
        <p className="text-sm text-muted-foreground">
          Das Lautsprecher-Symbol liest Abfahrten, Verbindungen und den Fahrtverlauf mit der
          Sprachausgabe deines Geräts vor. Dabei verlässt nichts dein Gerät.
        </p>
        <Segmented
          choices={SPEECH_RATES.map((r) => ({ value: r, label: SPEECH_RATE_LABEL[r] }))}
          value={settings.speechRate}
          onChange={(speechRate) => setSettings({ ...settings, speechRate })}
        />
        <SpeakButton
          pill
          text={() => "U 76 nach Holthausen, in 4 Minuten, 2 Minuten später, Steig 4."}
        />
      </section>

      <section aria-labelledby="settings-recent" className="space-y-2">
        <h2 id="settings-recent" className="text-lg font-semibold tracking-tight">
          Suchverlauf
        </h2>
        <p className="text-sm text-muted-foreground">
          {recent.length === 0
            ? "Keine zuletzt gesuchten Orte gespeichert."
            : `${recent.length} zuletzt gesuchte ${recent.length === 1 ? "Ort" : "Orte"}, angezeigt beim Antippen eines leeren Suchfelds.`}
        </p>
        <Button variant="outline" size="sm" disabled={recent.length === 0} onClick={clearRecent}>
          Verlauf löschen
        </Button>
      </section>

      <section aria-labelledby="settings-voice" className="space-y-2">
        <h2 id="settings-voice" className="text-lg font-semibold tracking-tight">
          Spracheingabe
        </h2>
        <p className="text-sm text-muted-foreground">
          {voiceConsent
            ? "Eingewilligt: Aufnahmen über das Mikrofon in der Suche gehen zur Erkennung an Cloudflare und werden danach nicht gespeichert."
            : "Nicht eingewilligt. Beim ersten Tippen aufs Mikrofon in der Suche fragt die App nach."}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!voiceConsent}
          onClick={() => {
            setVoiceConsent(false);
            setVoiceConsentState(false);
          }}
        >
          Einwilligung widerrufen
        </Button>
      </section>

      <p className="text-xs text-muted-foreground">
        Die Einstellungen gelten nur auf diesem Gerät und werden nur im Browser gespeichert.
      </p>
    </div>
  );
}
