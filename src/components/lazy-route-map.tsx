import { lazy, Suspense } from "react";
import type { Journey } from "../../shared/api-types";

// Routenkarte samt MapLibre nur bei Bedarf laden: über den Chunk der Kartenseite (map-page-*),
// damit MapLibre nicht im Haupt-Bundle und nicht doppelt bzw. in einem namenlosen Chunk landet
const RouteMapPanel = lazy(() =>
  import("@/pages/map-page").then((m) => ({ default: m.RouteMapPanel })),
);

export function LazyRouteMap({ journey }: { journey: Journey }) {
  return (
    <Suspense
      fallback={
        <p className="flex h-[260px] items-center justify-center rounded-lg border bg-muted text-muted-foreground">
          Karte wird geladen …
        </p>
      }
    >
      <RouteMapPanel journey={journey} />
    </Suspense>
  );
}
