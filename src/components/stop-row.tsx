import { Link } from "react-router";
import { ChevronRight, MapPin } from "lucide-react";
import type { Stop } from "../../shared/api-types";
import { stopPath } from "@/lib/api";
import { formatDistance } from "@/lib/geo";

/** Eine Haltestelle als Listenzeile (Suche, In der Nähe) */
export function StopRow({ stop, distanceKm }: { stop: Stop; distanceKm: number | null }) {
  return (
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
      {distanceKm !== null && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDistance(distanceKm)}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
