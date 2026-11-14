import { useId, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { cn } from "cn";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH } from "@/components/stop-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LocationState } from "@/hooks/use-location";
import { searchStops } from "@/lib/api";
import { formatDistance, rankStops } from "@/lib/geo";
import type { PickedStop } from "@/lib/journeys";

interface Option {
  key: string;
  label: string;
  detail?: string;
  distance?: string;
  /** null = „Mein Standort“ */
  stop: PickedStop | null;
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
  onSelect,
  onPickLocation,
}: {
  /** Sichtbare Beschriftung, z. B. „Von“ */
  label: string;
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
    queryKey: ["stops", "search", debounced],
    queryFn: ({ signal }) => searchStops(debounced, signal),
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
      stop: { id: stop.id, name: stop.name },
    })),
  ];
  const waiting = searching && (debounced !== query || isFetching);
  let status = "";
  if (searching) {
    if (isError) status = "Suche gerade nicht möglich.";
    else if (waiting && ranked.length === 0) status = "Suche läuft …";
    else if (!waiting && ranked.length === 0) status = "Keine Haltestelle gefunden.";
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
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-transparent pr-2 pl-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground" aria-hidden="true">
          {label}
        </span>
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
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
