import { useCallback, useSyncExternalStore } from "react";
import {
  addFavorite,
  type Favorite,
  getFavorites,
  moveFavorite,
  removeFavorite,
  renameFavorite,
  setFavorites,
  subscribeFavorites,
} from "@/lib/favorites";

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribeFavorites, getFavorites, () => []);

  const isFavorite = useCallback(
    (key: string) => favorites.some((f) => f.key === key),
    [favorites],
  );
  const add = useCallback(
    (favorite: Favorite) => setFavorites(addFavorite(getFavorites(), favorite)),
    [],
  );
  const remove = useCallback(
    (key: string) => setFavorites(removeFavorite(getFavorites(), key)),
    [],
  );
  const move = useCallback(
    (key: string, delta: number) => setFavorites(moveFavorite(getFavorites(), key, delta)),
    [],
  );
  const rename = useCallback(
    (key: string, label: string) => setFavorites(renameFavorite(getFavorites(), key, label)),
    [],
  );

  return { favorites, isFavorite, add, remove, move, rename };
}
