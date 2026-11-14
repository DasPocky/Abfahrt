import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { favoriteKey, toFavorite } from "@/lib/favorites";
import { type DepartureFilter, isEmptyFilter } from "@/lib/filters";
import type { Stop } from "../../shared/api-types";

/** Speichert die Haltestelle mit der aktuellen Ansicht (Filter) als Favorit. */
export function FavoriteButton({
  stop,
  filter,
}: {
  stop: Pick<Stop, "id" | "name" | "place">;
  filter: DepartureFilter;
}) {
  const { isFavorite, add, remove } = useFavorites();
  const key = favoriteKey(stop.id, filter);
  const active = isFavorite(key);
  const what = isEmptyFilter(filter) ? "Haltestelle" : "Ansicht";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={active}
      aria-label={active ? `${what} aus Favoriten entfernen` : `${what} zu Favoriten hinzufügen`}
      onClick={() => (active ? remove(key) : add(toFavorite(stop, filter)))}
    >
      <Star className={active ? "fill-warning text-warning" : undefined} aria-hidden="true" />
    </Button>
  );
}
