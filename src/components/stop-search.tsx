import { useId, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { LoaderCircle, LocateFixed, LocateOff, Mic, Route, Search, Square, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StopRow } from "@/components/stop-row";
import type { LocationState } from "@/hooks/use-location";
import { rankStops } from "@/lib/geo";
import { searchStops, stopPath } from "@/lib/api";
import { LocationHelp } from "@/components/location-help";
import { Button } from "@/components/ui/button";
import { useVoiceSearch, VOICE_EXAMPLES } from "@/hooks/use-voice-search";
import { parseIntent } from "@/lib/intent";

export const SEARCH_DEBOUNCE_MS = 250;
/** Nur um Start und Ziel zu erkennen; die Uhrzeit rechnet runText mit der aktuellen Zeit */
const PARSE_REFERENCE = new Date(0);
export const SEARCH_MIN_LENGTH = 2;

/** Einheitliche Symbol-Schaltflächen im Suchfeld (Größe, Strichstärke und Farbe wie die Lupe) */
const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StopSearch({ location }: { location: LocationState }) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;
  const navigate = useNavigate();
  const voice = useVoiceSearch(location.position);
  // Getippter Satz wie „von Benrath nach Essen“ (#131): als Verbindung anbieten
  const typedJourney = (() => {
    const intent = query.includes(" ") ? parseIntent(query, PARSE_REFERENCE) : null;
    return intent?.kind === "journey" ? intent : null;
  })();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const statusId = useId();

  const { data, isFetching, isError } = useQuery({
    queryKey: ["stops", "search", debounced],
    queryFn: ({ signal }) => searchStops(debounced, signal),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const showResults = query.trim().length >= SEARCH_MIN_LENGTH;
  const ranked = enabled && showResults ? rankStops(data?.stops ?? [], location.position) : [];
  const stops = ranked.map((r) => r.stop);
  const waiting = showResults && (debounced !== query.trim() || isFetching);

  function resultLinks(): HTMLAnchorElement[] {
    return Array.from(listRef.current?.querySelectorAll("a") ?? []);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      const first = resultLinks()[0];
      if (first) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "Enter" && typedJourney) {
      event.preventDefault();
      void voice.runText(query);
    } else if (event.key === "Enter") {
      const first = stops[0];
      if (first) {
        event.preventDefault();
        void navigate(stopPath(first.id), { state: { stopName: first.name } });
      }
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const links = resultLinks();
    const index = links.findIndex((link) => link === document.activeElement);
    if (index === -1) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      links[Math.min(index + 1, links.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else links[index - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  }

  let status = "";
  if (showResults) {
    if (isError) status = "Suche gerade nicht möglich. Bitte später erneut versuchen.";
    else if (waiting && stops.length === 0) status = "Suche läuft …";
    else if (!waiting && stops.length === 0) status = "Keine Haltestelle gefunden.";
    else if (location.status === "on") status = "Treffer in deiner Nähe zuerst.";
  }

  const locationLabel =
    location.status === "on"
      ? "Standort wird für die Sortierung genutzt – ausschalten"
      : location.status === "denied"
        ? "Standort nicht erlaubt – in den Browser-Einstellungen freigeben"
        : "Treffer nach Nähe zu meinem Standort sortieren";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Haltestelle suchen …"
          aria-label="Haltestelle suchen"
          aria-controls={listId}
          aria-describedby={statusId}
          className={cn(
            "h-12 pl-10 text-base md:text-base",
            voice.supported ? "pr-[7.5rem]" : "pr-[5.25rem]",
          )}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={location.ensureAsked}
          onKeyDown={onInputKeyDown}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {waiting ? (
            <span className={ICON_BUTTON} role="img" aria-label="Lädt">
              <LoaderCircle className="size-[1.125rem] animate-spin" aria-hidden="true" />
            </span>
          ) : (
            query !== "" && (
              <button
                type="button"
                className={cn(ICON_BUTTON, "text-muted-foreground hover:text-foreground")}
                aria-label="Suche leeren"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <X className="size-[1.125rem]" aria-hidden="true" />
              </button>
            )
          )}
          {voice.supported && (
            <button
              type="button"
              onClick={voice.onMic}
              aria-pressed={voice.phase === "listening"}
              aria-label={voice.phase === "listening" ? "Aufnahme beenden" : "Wunsch sprechen"}
              title={voice.phase === "listening" ? "Aufnahme beenden" : "Wunsch sprechen"}
              className={cn(
                ICON_BUTTON,
                voice.phase === "listening"
                  ? "bg-destructive text-white motion-safe:animate-pulse"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {voice.phase === "listening" ? (
                <Square className="size-[1.125rem]" aria-hidden="true" />
              ) : voice.phase === "working" ? (
                <LoaderCircle className="size-[1.125rem] animate-spin" aria-hidden="true" />
              ) : (
                <Mic className="size-[1.125rem]" aria-hidden="true" />
              )}
            </button>
          )}
          {/* feine Trennlinie: links Eingabe-Aktionen, rechts Standort */}
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={location.toggle}
            aria-pressed={location.status === "on"}
            aria-label={locationLabel}
            title={locationLabel}
            className={cn(
              ICON_BUTTON,
              location.status === "on"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {location.status === "locating" ? (
              <LoaderCircle className="size-[1.125rem] animate-spin" aria-hidden="true" />
            ) : location.status === "denied" || location.status === "unavailable" ? (
              <LocateOff className="size-[1.125rem]" aria-hidden="true" />
            ) : (
              <LocateFixed className="size-[1.125rem]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {voice.phase === "consent" && (
        <div
          role="group"
          aria-labelledby={`${statusId}-voice`}
          className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <p id={`${statusId}-voice`} className="font-medium">
            Spracheingabe
          </p>
          <p className="text-muted-foreground">
            Sag einfach, was du suchst, z. B. {VOICE_EXAMPLES}. Deine Aufnahme (höchstens 10
            Sekunden) geht über unseren Server an die Spracherkennung von Cloudflare und wird danach
            nicht gespeichert. Zurück kommt nur der Text. Widerrufen kannst du das in den
            Einstellungen.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={voice.acceptConsent}>
              Einverstanden
            </Button>
            <Button size="sm" variant="outline" onClick={voice.declineConsent}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
      {(voice.phase === "listening" || voice.message) && (
        <p role="status" aria-live="polite" className="px-1 text-sm">
          {voice.phase === "listening" ? (
            <span className="font-medium">Ich höre zu … sprich jetzt.</span>
          ) : (
            voice.message
          )}
        </p>
      )}
      {typedJourney && (
        <Button
          variant="outline"
          className="h-auto w-full justify-start gap-2 py-2 text-left whitespace-normal"
          onClick={() => void voice.runText(query)}
        >
          <Route aria-hidden="true" />
          <span>
            Verbindung suchen: {typedJourney.from ?? "Mein Standort"} → {typedJourney.to}
          </span>
        </Button>
      )}

      <p id={statusId} role="status" className="min-h-5 px-1 text-sm text-muted-foreground">
        {status}
        {!status && location.status === "denied" && (
          <>
            Standort nicht freigegeben. <LocationHelp />
          </>
        )}
      </p>

      <ul
        id={listId}
        ref={listRef}
        aria-label="Suchergebnisse"
        className="divide-y overflow-hidden rounded-lg border empty:hidden"
        onKeyDown={onListKeyDown}
      >
        {ranked.map(({ stop, distanceKm }) => (
          <li key={stop.id}>
            <StopRow stop={stop} distanceKm={distanceKm} />
          </li>
        ))}
      </ul>
    </div>
  );
}
