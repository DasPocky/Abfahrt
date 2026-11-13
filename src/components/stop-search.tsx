import { useId, useRef, useState, type KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { ChevronRight, LoaderCircle, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchStops, stopPath } from "@/lib/api";

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_MIN_LENGTH = 2;

export function StopSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;
  const navigate = useNavigate();
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
  const stops = enabled && showResults ? (data?.stops ?? []) : [];
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
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
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
          className="h-12 pr-10 pl-10 text-base md:text-base"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
        />
        {waiting && (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Lädt"
            role="img"
          />
        )}
      </div>

      <p id={statusId} role="status" className="min-h-5 px-1 text-sm text-muted-foreground">
        {status}
      </p>

      <ul
        id={listId}
        ref={listRef}
        aria-label="Suchergebnisse"
        className="divide-y overflow-hidden rounded-lg border empty:hidden"
        onKeyDown={onListKeyDown}
      >
        {stops.map((stop) => (
          <li key={stop.id}>
            <Link
              to={stopPath(stop.id)}
              state={{ stopName: stop.name }}
              className="flex min-h-12 items-center gap-3 px-3 py-2 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{stop.name}</span>
                {stop.place && (
                  <span className="block truncate text-sm text-muted-foreground">{stop.place}</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
