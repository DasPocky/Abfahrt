import { Link } from "react-router";
import { ChevronRight, X } from "lucide-react";
import type { Stop } from "../../shared/api-types";
import { PlaceIcon } from "@/components/place-icon";
import { stopPath } from "@/lib/api";
import { formatDistance } from "@/lib/geo";

/** Eine Haltestelle als Listenzeile (Suche, zuletzt gesucht, In der Nähe) */
export function StopRow({
  stop,
  distanceKm,
  onOpen,
  onRemove,
}: {
  stop: Stop;
  distanceKm: number | null;
  /** beim Öffnen, z. B. um sie als zuletzt gesucht zu merken */
  onOpen?: () => void;
  /** mit: Knopf zum Entfernen aus dem Verlauf statt Pfeil */
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center">
      <Link
        to={stopPath(stop.id)}
        state={{ stopName: stop.name }}
        onClick={onOpen}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3 py-2 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <PlaceIcon />
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
        {!onRemove && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${stop.name} aus dem Verlauf entfernen`}
          className="flex size-12 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
