import { useLayoutEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { BannerNotice } from "@/components/banner-notice";
import { FavoriteAlertsBanner } from "@/components/favorite-alerts-banner";
import { FavoriteCard } from "@/components/favorite-card";
import { NearbyStops } from "@/components/nearby-stops";
import { SavedTripCard } from "@/components/saved-trip-card";
import { StopSearch } from "@/components/stop-search";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import { useSettings } from "@/hooks/use-settings";
import { fitFavorites, type CardSize } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { COUNTDOWN_TICK_MS } from "@/pages/stop-page";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/page-header";

/** „In der Nähe“ auf dem Dashboard: nur die nächsten beiden */
const NEARBY_ON_DASHBOARD = 2;

const sameSizes = (a: CardSize[], b: CardSize[]) =>
  a.length === b.length &&
  a.every(
    (x, i) =>
      Math.abs(x.chrome - (b[i]?.chrome ?? 0)) < 1 &&
      x.rows.length === b[i]?.rows.length &&
      x.rows.every((r, j) => Math.abs(r - (b[i]?.rows[j] ?? 0)) < 1),
  );

/**
 * Startseite als Dashboard: Suche, gemerkte Verbindung, Favoriten mit Live-Abfahrten und „In der
 * Nähe“ passen ohne Scrollen zwischen Kopf und Tab-Leiste. Eine unsichtbare Messkopie zeigt jede
 * Karte mit allen Abfahrten; aus ihren echten Höhen rechnet lib/dashboard.ts, was sichtbar passt.
 * Die Messkopie hängt nicht von dieser Rechnung ab, deshalb schaukelt sich nichts auf.
 * Beim Bearbeiten und mit „alle anzeigen“ scrollt die Seite wie gewohnt.
 */
export function HomePage() {
  usePageTitle("Abfahrten");
  const { favorites, move, remove, rename } = useFavorites();
  const { favoriteCount } = useSettings();
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const now = useNow(COUNTDOWN_TICK_MS);
  const location = useLocation();
  const isEditing = editing && favorites.length > 0;
  const dashboard = !isEditing && !showAll;

  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const probe = useRef<HTMLUListElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [available, setAvailable] = useState(0);
  const [sizes, setSizes] = useState<CardSize[]>([]);

  // Höhe bis zur Tab-Leiste, Platz für die Liste und die Maße aus der Messkopie
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!dashboard) {
      delete root.dataset.dashboard;
      return undefined;
    }
    root.dataset.dashboard = "";
    // Nach jeder Änderung der Favoriten neu beobachten: die Messkopie hat dann andere Karten
    const count = favorites.length;
    const measure = () => {
      const el = box.current;
      if (!el) return;
      const bar = document.querySelector('nav[aria-label="Hauptnavigation"]');
      const bottom = bar ? bar.getBoundingClientRect().top : innerHeight;
      const h = Math.max(240, Math.floor(bottom - (el.getBoundingClientRect().top + scrollY) - 8));
      setHeight((old) => (old === h ? old : h));
      const free = list.current?.clientHeight ?? 0;
      setAvailable((old) => (Math.abs(old - free) < 1 ? old : free));
      const next = [...(probe.current?.children ?? [])].slice(0, count).map((card) => {
        const rows = [...card.querySelectorAll('ul[aria-label="Abfahrten"] > li')].map(
          (r) => r.getBoundingClientRect().height,
        );
        return {
          chrome: card.getBoundingClientRect().height - rows.reduce((a, b) => a + b, 0),
          rows,
        };
      });
      setSizes((old) => (sameSizes(old, next) ? old : next));
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    for (const target of [box.current, list.current, probe.current])
      if (target) observer?.observe(target);
    for (const card of probe.current?.children ?? []) observer?.observe(card);
    addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      removeEventListener("resize", measure);
      delete root.dataset.dashboard;
    };
  }, [dashboard, favorites.length]);

  // Erst mit echtem Layout verteilen; ohne (vor der Messung, Testumgebung) zeigt die Seite alles
  const fitted = dashboard && available > 0;
  const measured = sizes.length === favorites.length;
  const rowsPerCard = !fitted
    ? favorites.map(() => favoriteCount)
    : measured
      ? fitFavorites(available, sizes, favoriteCount)
      : [];
  const hidden = favorites.length - rowsPerCard.length;

  return (
    <div
      ref={box}
      style={dashboard && height ? { height } : undefined}
      className={cn(dashboard ? "flex flex-col gap-4 overflow-hidden" : "space-y-6")}
    >
      <section aria-labelledby="home-title" className="shrink-0 space-y-2">
        <PageHeader id="home-title" title="Abfahrten" />
        <StopSearch location={location} />
      </section>

      <div className="shrink-0 space-y-2">
        <BannerNotice />
        <SavedTripCard />
      </div>

      <section
        aria-labelledby="favorites-title"
        className={cn(dashboard ? "relative flex min-h-0 flex-1 flex-col gap-2" : "space-y-3")}
      >
        {favorites.length > 0 && <FavoriteAlertsBanner favorites={favorites} />}
        <div className="flex shrink-0 items-center justify-between">
          <h2 id="favorites-title" className="text-lg font-semibold tracking-tight">
            Meine Haltestellen
          </h2>
          {favorites.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={isEditing}
              onClick={() => {
                setEditing((v) => !v);
                setShowAll(false);
              }}
            >
              {isEditing ? "Fertig" : "Bearbeiten"}
            </Button>
          )}
        </div>
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-6 text-center">
            <Star className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Noch keine Favoriten. Öffne eine Haltestelle, wähle bei Bedarf Filter (z. B. nur
              S-Bahn) und tippe auf den Stern. Dann erscheint diese Ansicht hier.
            </p>
          </div>
        ) : (
          <>
            <ul
              ref={list}
              aria-label="Favoriten"
              className={cn("space-y-3", dashboard && "min-h-0 flex-1 overflow-hidden")}
            >
              {favorites.slice(0, rowsPerCard.length).map((favorite, index) => (
                <li key={favorite.key} data-favorite-card>
                  <FavoriteCard
                    favorite={favorite}
                    now={now}
                    editing={isEditing}
                    isFirst={index === 0}
                    isLast={index === favorites.length - 1}
                    onMove={(delta) => move(favorite.key, delta)}
                    onRemove={() => remove(favorite.key)}
                    onRename={(label) => rename(favorite.key, label)}
                    limit={rowsPerCard[index] ?? favoriteCount}
                  />
                </li>
              ))}
              {fitted && measured && hidden > 0 && (
                <li>
                  <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                    + {hidden} {hidden === 1 ? "weitere Haltestelle" : "weitere Haltestellen"}
                  </Button>
                </li>
              )}
            </ul>
            {/* Messkopie: alle Karten mit allen Abfahrten, unsichtbar und nicht bedienbar */}
            {dashboard && (
              <ul
                ref={probe}
                aria-hidden="true"
                inert
                className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10 space-y-3"
              >
                {favorites.map((favorite, index) => (
                  <li key={favorite.key}>
                    <FavoriteCard
                      favorite={favorite}
                      now={now}
                      editing={false}
                      isFirst={index === 0}
                      isLast={index === favorites.length - 1}
                      onMove={() => {}}
                      onRemove={() => {}}
                      onRename={() => {}}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {showAll && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowAll(false)}
          >
            Weniger anzeigen
          </Button>
        )}
      </section>

      <div className="shrink-0">
        <NearbyStops location={location} max={fitted ? NEARBY_ON_DASHBOARD : undefined} />
      </div>
    </div>
  );
}
