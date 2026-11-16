import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { NOTICE_CLASS } from "@/components/departure-list";
import { fetchAlerts } from "@/lib/api";
import { ALERTS_STALE_MS, favoriteAlerts, favoriteAlertStops, stopAlertsKey } from "@/lib/alerts";
import type { Favorite } from "@/lib/favorites";
import type { Alert } from "../../shared/api-types";

/** Höchstens so viele Favoriten-Haltestellen werden abgefragt */
export const FAVORITE_ALERT_STOPS = 5;

/** Kompakter Hinweis über „Meine Haltestellen“: Störungen bei den Favoriten, Link zur Übersicht */
export function FavoriteAlertsBanner({ favorites }: { favorites: readonly Favorite[] }) {
  const stops = favoriteAlertStops(favorites, FAVORITE_ALERT_STOPS);
  const results = useQueries({
    queries: stops.map(({ stopId, lines }) => ({
      queryKey: stopAlertsKey(stopId, lines),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchAlerts({ stop: stopId, lines }, signal),
      staleTime: ALERTS_STALE_MS,
    })),
  });
  const all: Alert[] = results.flatMap((r) => r.data?.alerts ?? []);
  const affecting = favoriteAlerts(all, favorites);
  if (affecting.length === 0) return null;
  const [first] = affecting;
  return (
    <Link to="/stoerungen" className={NOTICE_CLASS}>
      <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">
          {affecting.length === 1 ? "1 Störung" : `${affecting.length} Störungen`} bei deinen
          Favoriten
        </span>
        {affecting.length === 1 && first && (
          <span className="text-muted-foreground">: {first.title}</span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
