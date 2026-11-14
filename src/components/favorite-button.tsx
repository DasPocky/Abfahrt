import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { toFavorite } from "@/lib/favorites";
import type { Stop } from "../../shared/api-types";

export function FavoriteButton({ stop }: { stop: Pick<Stop, "id" | "name" | "place"> }) {
  const { isFavorite, add, remove } = useFavorites();
  const active = isFavorite(stop.id);
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={active}
      aria-label={active ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      onClick={() => (active ? remove(stop.id) : add(toFavorite(stop)))}
    >
      <Star className={active ? "fill-warning text-warning" : undefined} aria-hidden="true" />
    </Button>
  );
}
