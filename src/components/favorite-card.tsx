import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { DepartureList } from "@/components/departure-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchDepartures, stopPath } from "@/lib/api";
import { sortDepartures, upcomingDepartures } from "@/lib/departures";
import type { Favorite } from "@/lib/favorites";
import { describeFilter, filterDepartures, filterToParams } from "@/lib/filters";
import { DEPARTURES_REFETCH_MS } from "@/pages/stop-page";

/** Abfahrten pro Favorit auf der Startseite */
export const FAVORITE_PREVIEW_COUNT = 4;

export function FavoriteCard({
  favorite,
  now,
  editing,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onRename,
}: {
  favorite: Favorite;
  now: Date;
  editing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(favorite.label ?? "");
  const { data, isPending, isError } = useQuery({
    // gleicher Schlüssel wie auf der Haltestellenseite: Daten werden geteilt
    queryKey: ["departures", favorite.stopId, "now"],
    queryFn: ({ signal }) => fetchDepartures(favorite.stopId, signal),
    refetchInterval: DEPARTURES_REFETCH_MS,
    enabled: !editing,
  });
  const preview = data
    ? upcomingDepartures(
        sortDepartures(filterDepartures(data.departures, favorite.filter)),
        now,
      ).slice(0, FAVORITE_PREVIEW_COUNT)
    : [];
  const params = filterToParams(favorite.filter, false).toString();
  const to = params ? `${stopPath(favorite.stopId)}?${params}` : stopPath(favorite.stopId);
  const title = favorite.label ?? favorite.name;
  const details = [favorite.label ? favorite.name : favorite.place, describeFilter(favorite.filter)]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onRename(draft);
              setRenaming(false);
            }}
          >
            <Input
              aria-label="Eigener Name"
              placeholder={favorite.name}
              value={draft}
              maxLength={40}
              autoFocus
              className="h-8"
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Namen speichern"
            >
              <Check aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <Link
            to={to}
            state={{ stopName: favorite.name }}
            className="group flex min-w-0 flex-1 items-center gap-1 rounded-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold group-hover:underline">{title}</span>
              {details && (
                <span className="block truncate text-xs text-muted-foreground">{details}</span>
              )}
            </span>
            {!editing && (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </Link>
        )}
      </div>

      {editing ? (
        <div className="flex items-center justify-end gap-1 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(favorite.label ?? "");
              setRenaming(true);
            }}
            aria-label={`${title} umbenennen`}
          >
            <Pencil aria-hidden="true" />
            Umbenennen
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={`${title} nach oben`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={`${title} nach unten`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={`${title} aus Favoriten entfernen`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <CardContent className="px-4">
          {isPending && (
            <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Abfahrten werden geladen …
            </p>
          )}
          {isError && !data && (
            <p role="alert" className="py-3 text-sm text-destructive">
              Abfahrten konnten nicht geladen werden.
            </p>
          )}
          {data && <DepartureList departures={preview} now={now} compact />}
        </CardContent>
      )}
    </Card>
  );
}
