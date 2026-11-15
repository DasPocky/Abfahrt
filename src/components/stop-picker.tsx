import { useId, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { House, Landmark, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import type { PlaceKind } from "../../shared/api-types";
import { cn } from "cn";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from "@/components/stop-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LocationState } from "@/hooks/use-location";
import { searchStops } from "@/lib/api";
import { formatDistance, rankStops } from "@/lib/geo";
import type { PickedStop } from "@/lib/journeys";
import { stopLabel } from "@/lib/stop-label";

interface Option {
  key: string;
  label: string;
  detail?: string;
  distance?: string;
  /** null = „Mein Standort“ */
  stop: PickedStop | null;
  kind?: PlaceKind;
}

/** Symbol je Treffer: Haltestelle, Adresse, Ort */
function KindIcon({ kind }: { kind: PlaceKind | undefined }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (kind === "address") return <House className={className} aria-label="Adresse" />;
  if (kind === "poi") return <Landmark className={className} aria-label="Ort" />;
  return <MapPin className={className} aria-hidden="true" />;
}

/**
 * Kompakte Haltestellen-Auswahl (Combobox) für die Verbindungssuche: Treffer nach Nähe sortiert,
 * dazu „Mein Standort“. Pfeiltasten wählen, Enter übernimmt, Esc verwirft die Eingabe.
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
}: {
  /** Beschriftung für Screenreader, z. B. „Von“ */
  label: string;
  /** Punkt vor dem Feld: Start hohl, Ziel gefüllt (wie auf der Karte) */
  marker: "start" | "end";
  placeholder: string;
  value: PickedStop | null;
  location: LocationState;
  /** „Mein Standort“ wird gerade aufgelöst */
  locating?: boolean;
  onSelect: (stop: PickedStop) => void;
  onPickLocation: () => void;
}) {
  // null = Name der gewählten Haltestelle anzeigen, sonst den eingetippten Text
  const [editing, setEditing] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;

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
  const ranked = enabled && searching ? rankStops(data?.stops ?? [], location.position, 8) : [];
  const options: Option[] = [
    { key: "location", label: "Mein Standort", detail: "nächste Haltestelle", stop: null },
    ...ranked.map(({ stop, distanceKm }) => ({
      key: stop.id,
      label: stop.name,
      detail: stop.place,
      distance: distanceKm === null ? undefined : formatDistance(distanceKm),
      stop: { id: stop.id, name: stopLabel(stop) },
      kind: stop.kind,
    })),
  ];
  const waiting = searching && (debounced !== query || isFetching);
  let status = "";
  if (searching) {
    if (isError) status = "Suche gerade nicht möglich.";
    else if (waiting && ranked.length === 0) status = "Suche läuft …";
    else if (!waiting && ranked.length === 0) status = "Nichts gefunden.";
  }
  const open = focused;

  function choose(option: Option) {
    setEditing(null);
    setActive(-1);
    if (option.stop) onSelect(option.stop);
    else onPickLocation();
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
      const option = options[active] ?? (searching ? options[1] : undefined);
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
      <div className="flex h-11 items-center gap-2.5 pr-11 pl-3 focus-within:bg-muted/50">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full border-2 border-foreground",
            marker === "end" && "bg-foreground",
          )}
          aria-hidden="true"
        />
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
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 divide-y overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        {options.map((option, index) => (
          <li
            key={option.key}
            id={`${id}-${option.key}`}
            role="option"
            aria-selected={index === active}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm",
              index === active ? "bg-muted" : "hover:bg-muted",
            )}
            // Fokus im Feld halten, sonst schließt blur die Liste vor dem Klick
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            {option.stop ? (
              <KindIcon kind={option.kind} />
            ) : (
              <LocateFixed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">
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
        ))}
        {status && (
          <li role="presentation" className="px-2.5 py-1.5 text-sm text-muted-foreground">
            {status}
          </li>
        )}
      </ul>
    </div>
  );
}
