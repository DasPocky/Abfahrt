// Routenkarte unter den Details einer Verbindung. Lazy geladen über den Chunk der Kartenseite,
// siehe lazy-route-map.tsx.
import { useMemo } from "react";
import { MapAttribution } from "@/components/map-attribution";
import { RouteMap } from "@/components/route-map";
import { usePrefersDark } from "@/hooks/use-prefers-dark";
import { routeData } from "@/lib/route-map";
import type { Journey } from "../../shared/api-types";

export function RouteMapPanel({ journey }: { journey: Journey }) {
  const dark = usePrefersDark();
  const data = useMemo(() => routeData(journey, dark), [journey, dark]);
  const from = journey.legs[0]?.origin.name ?? "";
  const to = journey.legs.at(-1)?.destination.name ?? "";
  return (
    <div className="relative h-[260px] overflow-hidden rounded-lg border bg-muted">
      <RouteMap data={data} dark={dark} label={`Routenkarte von ${from} nach ${to}`} />
      <MapAttribution />
    </div>
  );
}
