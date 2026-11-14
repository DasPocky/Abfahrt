import { lazy, Suspense } from "react";

// Karte samt MapLibre nur bei Bedarf laden (eigener Chunk, nicht im Haupt-Bundle)
const MapPage = lazy(() => import("@/pages/map-page"));

export function LazyMapPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Karte wird geladen …</p>}>
      <MapPage />
    </Suspense>
  );
}
