import { FavoriteCard } from "@/components/favorite-card";
import { StopSearch } from "@/components/stop-search";
import { useFavorites } from "@/hooks/use-favorites";
import { useNow } from "@/hooks/use-now";
import { COUNTDOWN_TICK_MS } from "@/pages/stop-page";

export function HomePage() {
  const { favorites, move, remove, rename } = useFavorites();
  const now = useNow(COUNTDOWN_TICK_MS);

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-title" className="space-y-4">
        <div className="space-y-1">
          <h1 id="home-title" className="text-2xl font-semibold tracking-tight">
            Abfahrten
          </h1>
          <p className="text-sm text-muted-foreground">
            Haltestelle suchen und Live-Abfahrten für Bus und Bahn sehen.
          </p>
        </div>
        <StopSearch />
      </section>

      <section aria-labelledby="favorites-title" className="space-y-3">
        <h2 id="favorites-title" className="text-lg font-semibold tracking-tight">
          Meine Haltestellen
        </h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Favoriten. Öffne eine Haltestelle, wähle bei Bedarf Filter (z. B. nur S-Bahn)
            und tippe auf den Stern. Dann erscheint diese Ansicht hier.
          </p>
        ) : (
          <ul aria-label="Favoriten" className="space-y-3">
            {favorites.map((favorite, index) => (
              <li key={favorite.key}>
                <FavoriteCard
                  favorite={favorite}
                  now={now}
                  isFirst={index === 0}
                  isLast={index === favorites.length - 1}
                  onMove={(delta) => move(favorite.key, delta)}
                  onRemove={() => remove(favorite.key)}
                  onRename={(label) => rename(favorite.key, label)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
