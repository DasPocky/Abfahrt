import { useCallback, useSyncExternalStore } from "react";
import {
  addFavorite,
  type Favorite,
  getFavorites,
  moveFavorite,
  removeFavorite,
  setFavorites,
  subscribeFavorites,
} from "@/lib/favorites";

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribeFavorites, getFavorites, () => []);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);
  const add = useCallback(
    (favorite: Favorite) => setFavorites(addFavorite(getFavorites(), favorite)),
    [],
  );
  const remove = useCallback((id: string) => setFavorites(removeFavorite(getFavorites(), id)), []);
  const move = useCallback(
    (id: string, delta: number) => setFavorites(moveFavorite(getFavorites(), id, delta)),
    [],
  );

  return { favorites, isFavorite, add, remove, move };
}
