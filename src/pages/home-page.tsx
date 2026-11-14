import { useState } from "react";
import { Star } from "lucide-react";
import { FavoriteCard } from "@/components/favorite-card";
import { NearbyStops } from "@/components/nearby-stops";
import { StopSearch } from "@/components/stop-search";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import { COUNTDOWN_TICK_MS } from "@/pages/stop-page";

export function HomePage() {
  const { favorites, move, remove, rename } = useFavorites();
  const [editing, setEditing] = useState(false);
  const now = useNow(COUNTDOWN_TICK_MS);
  const location = useLocation();
  const isEditing = editing && favorites.length > 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="home-title" className="space-y-2">
        <h1 id="home-title" className="sr-only">
          Abfahrten suchen
        </h1>
        <StopSearch location={location} />
      </section>

      <section aria-labelledby="favorites-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="favorites-title" className="text-lg font-semibold tracking-tight">
            Meine Haltestellen
          </h2>
          {favorites.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={isEditing}
              onClick={() => setEditing((v) => !v)}
            >
              {isEditing ? "Fertig" : "Bearbeiten"}
            </Button>
          )}
        </div>
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center">
            <Star className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Noch keine Favoriten. Öffne eine Haltestelle, wähle bei Bedarf Filter (z. B. nur
              S-Bahn) und tippe auf den Stern. Dann erscheint diese Ansicht hier.
            </p>
          </div>
        ) : (
          <ul aria-label="Favoriten" className="space-y-3">
            {favorites.map((favorite, index) => (
              <li key={favorite.key}>
                <FavoriteCard
                  favorite={favorite}
                  now={now}
                  editing={isEditing}
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

      <NearbyStops location={location} />
    </div>
  );
}
