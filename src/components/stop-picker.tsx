import { Fragment, useId, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import type { Stop } from "../../shared/api-types";
import { cn } from "cn";
import { PlaceIcon } from "@/components/place-icon";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from "@/components/stop-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFavorites } from "@/hooks/use-favorites";
import type { LocationState } from "@/hooks/use-location";
import { useRecentPlaces } from "@/hooks/use-recent-places";
import { searchStops } from "@/lib/api";
import { distanceKm, formatDistance, isStopHit, rankPlaces } from "@/lib/geo";
import type { PickedStop } from "@/lib/journeys";
import { recentToStop, rememberPlace } from "@/lib/recent-places";
import { PLACE_KIND_LABEL, stopLabel } from "@/lib/stop-label";

/** Gruppen der Vorschläge, in dieser Reihenfolge */
type Group = "location" | "recent" | "favorite" | "stops" | "places";

interface Option {
  key: string;
  group: Group;
  label: string;
  detail?: string;
  distance?: string;
  /** null = „Mein Standort“ */
  stop: Stop | null;
}

/** Höchstens so viele Favoriten im leeren Feld */
const MAX_FAVORITE_OPTIONS = 5;

/** Überschrift vor der ersten Option einer Gruppe (nur wo sie beim Lesen hilft) */
function groupHeading(option: Option, previous: Option | undefined, all: Option[]): string | null {
  if (previous?.group === option.group) return null;
  switch (option.group) {
    case "recent":
      return "Zuletzt";
    case "favorite":
      return "Favoriten";
    case "places":
      return all.some((o) => o.group === "stops") ? "Adressen und Orte" : null;
    case "stops":
      return previous?.group === "places" ? "Haltestellen" : null;
    default:
      return null;
  }
}

/**
 * Kompakte Auswahl (Combobox) für die Verbindungssuche. Leeres Feld: „Mein Standort“, zuletzt
 * gewählte Orte, Favoriten. Beim Tippen: Haltestellen zuerst, danach Adressen und Orte (#119).
 * Pfeiltasten wählen, Enter übernimmt, Esc verwirft die Eingabe.
 */
export function StopPicker({
  label,
  placeholder,
  value,
  location,
  locating = false,
  marker,
  onSelect,
  onPickLocation,
  stopsOnly = false,
}: {
  /** Beschriftung für Screenreader, z. B. „Von“ */
  label: string;
  /** Punkt vor dem Feld: Start hohl, Ziel gefüllt (wie auf der Karte); ohne: Pin-Symbol */
  marker?: "start" | "end";
  placeholder: string;
  value: PickedStop | null;
  location: LocationState;
  /** „Mein Standort“ wird gerade aufgelöst */
  locating?: boolean;
  onSelect: (stop: PickedStop) => void;
  /** ohne: kein Eintrag „Mein Standort“ (z. B. Zwischenhalt) */
  onPickLocation?: () => void;
  /** nur Haltestellen, keine Adressen/Orte (z. B. Zwischenhalt, #101) */
  stopsOnly?: boolean;
}) {
  // null = Name der gewählten Haltestelle anzeigen, sonst den eingetippten Text
  const [editing, setEditing] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const recent = useRecentPlaces();
  const { favorites } = useFavorites();

  const query = editing?.trim() ?? "";
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;
  const { data, isFetching, isError } = useQuery({
    queryKey: ["stops", "search", "places", debounced],
    queryFn: ({ signal }) => searchStops(debounced, signal, true),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const searching = query.length >= SEARCH_MIN_LENGTH;
  const position = location.position;
  const found = (data?.stops ?? []).filter((s) => !stopsOnly || isStopHit(s));
  const ranked = enabled && searching ? rankPlaces(found, position, debounced) : [];

  function optionFor(stop: Stop, group: Group, km?: number | null): Option {
    let distance = km ?? null;
    if (km === undefined && position && stop.lat !== undefined && stop.lon !== undefined) {
      distance = distanceKm(position, { lat: stop.lat, lon: stop.lon });
    }
    return {
      key: `${group}-${stop.id}`,
      group,
      label: stop.name,
      detail: stop.place,
      distance: distance === null ? undefined : formatDistance(distance),
      stop,
    };
  }

  let options: Option[];
  if (searching) {
    options = ranked.map(({ stop, distanceKm: km }) =>
      optionFor(stop, isStopHit(stop) ? "stops" : "places", km),
    );
  } else {
    const recentStops = recent.map(recentToStop).filter((s) => !stopsOnly || isStopHit(s));
    const shown = new Set(recentStops.map((s) => s.id));
    const favoriteStops: Stop[] = [];
    for (const f of favorites) {
      if (shown.has(f.stopId) || favoriteStops.length >= MAX_FAVORITE_OPTIONS) continue;
      shown.add(f.stopId);
      favoriteStops.push({ id: f.stopId, name: f.name, ...(f.place ? { place: f.place } : {}) });
    }
    options = [
      ...recentStops.map((s) => optionFor(s, "recent")),
      ...favoriteStops.map((s) => optionFor(s, "favorite")),
    ];
  }
  if (onPickLocation) {
    options.unshift({
      key: "location",
      group: "location",
      label: "Mein Standort",
      detail: "nächste Haltestelle",
      stop: null,
    });
  }
  const waiting = searching && (debounced !== query || isFetching);
  let status = "";
  if (searching) {
    if (isError) status = "Suche gerade nicht möglich.";
    else if (waiting && ranked.length === 0) status = "Suche läuft …";
    else if (!waiting && ranked.length === 0) status = "Nichts gefunden.";
  }
  const open = focused && (options.length > 0 || status !== "");

  function choose(option: Option) {
    setEditing(null);
    setActive(-1);
    if (option.stop) {
      rememberPlace(option.stop);
      onSelect({ id: option.stop.id, name: stopLabel(option.stop) });
    } else onPickLocation?.();
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // ohne Auswahl per Pfeil: bester Treffer (nicht „Mein Standort“)
      const option = options[active] ?? (searching ? options.find((o) => o.stop) : undefined);
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === "Escape") {
      setEditing(null);
      setActive(-1);
    }
  }

  const activeOption = open ? options[active] : undefined;

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* Ohne eigenen Rahmen: Von und Nach stehen gemeinsam in einem Kasten (journey-page) */}
      <div className="flex h-11 items-center gap-2.5 pr-11 pl-3 focus-within:bg-muted/50 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-inset">
        {marker ? (
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full border-2 border-foreground",
              marker === "end" && "bg-foreground",
            )}
            aria-hidden="true"
          />
        ) : (
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${id}-${activeOption.key}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          value={locating ? "Mein Standort …" : (editing ?? value?.name ?? "")}
          onChange={(event) => {
            setEditing(event.target.value);
            setActive(-1);
          }}
          onFocus={(event) => {
            setFocused(true);
            event.target.select();
            location.ensureAsked();
          }}
          onBlur={() => {
            setFocused(false);
            setEditing(null);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        {(waiting || locating) && (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            role="img"
            aria-label="Lädt"
          />
        )}
      </div>
      <p role="status" className="sr-only">
        {open ? status : ""}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label}: Vorschläge`}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-[min(28rem,60vh)] divide-y overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        {options.map((option, index) => {
          const heading = groupHeading(option, options[index - 1], options);
          return (
            <Fragment key={option.key}>
              {heading && (
                <li
                  role="presentation"
                  className="bg-muted/40 px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                >
                  {heading}
                </li>
              )}
              <li
                id={`${id}-${option.key}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm",
                  index === active ? "bg-muted" : "hover:bg-muted",
                )}
                // Fokus im Feld halten, sonst schließt blur die Liste vor dem Klick
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span className="flex w-5 shrink-0 justify-center">
                  {option.stop ? (
                    <PlaceIcon kind={option.stop.kind} />
                  ) : (
                    <LocateFixed className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {option.stop && (
                    <span className="sr-only">
                      {PLACE_KIND_LABEL[option.stop.kind ?? "stop"]}:{" "}
                    </span>
                  )}
                  <span className="font-medium">{option.label}</span>
                  {option.detail && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {option.detail}
                    </span>
                  )}
                </span>
                {option.distance && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {option.distance}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
        {status && (
          <li role="presentation" className="px-2.5 py-1.5 text-sm text-muted-foreground">
            {status}
          </li>
        )}
      </ul>
    </div>
  );
}
