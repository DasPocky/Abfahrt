import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, ChevronRight, LoaderCircle, Trash2 } from "lucide-react";
import { DepartureList } from "@/components/departure-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDepartures } from "@/lib/api";
import { sortDepartures, upcomingDepartures } from "@/lib/departures";
import type { Favorite } from "@/lib/favorites";
import { DEPARTURES_REFETCH_MS } from "@/pages/stop-page";

/** Abfahrten pro Favorit auf der Startseite */
export const FAVORITE_PREVIEW_COUNT = 4;

export function FavoriteCard({
  favorite,
  now,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: {
  favorite: Favorite;
  now: Date;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { data, isPending, isError } = useQuery({
    // gleicher Schlüssel wie auf der Haltestellenseite: Daten werden geteilt
    queryKey: ["departures", favorite.id],
    queryFn: ({ signal }) => fetchDepartures(favorite.id, signal),
    refetchInterval: DEPARTURES_REFETCH_MS,
  });
  const preview = data
    ? upcomingDepartures(sortDepartures(data.departures), now).slice(0, FAVORITE_PREVIEW_COUNT)
    : [];
  const stopPath = `/haltestelle/${encodeURIComponent(favorite.id)}`;

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="flex flex-row items-center gap-1 px-4">
        <CardTitle className="min-w-0 flex-1 text-base">
          <Link
            to={stopPath}
            state={{ stopName: favorite.name }}
            className="flex items-center gap-1 hover:underline"
          >
            <span className="truncate">{favorite.name}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
          {favorite.place && (
            <span className="block text-xs font-normal text-muted-foreground">
              {favorite.place}
            </span>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label={`${favorite.name} nach oben`}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label={`${favorite.name} nach unten`}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`${favorite.name} aus Favoriten entfernen`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </CardHeader>
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
        {data && <DepartureList departures={preview} now={now} />}
      </CardContent>
    </Card>
  );
}
