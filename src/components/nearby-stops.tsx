import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import { StopRow } from "@/components/stop-row";
import { Button } from "@/components/ui/button";
import type { LocationState } from "@/hooks/use-location";
import { nearbyStops, roundCoord } from "@/lib/api";
import { distanceKm } from "@/lib/geo";

/** So viele Haltestellen zeigt die Startseite, der Rest steckt hinter „Alle anzeigen“ */
export const NEARBY_VISIBLE = 4;

/** „In der Nähe“ auf der Startseite: Haltestellen im Umkreis von 1 km, nächste zuerst */
export function NearbyStops({ location }: { location: LocationState }) {
  const [expanded, setExpanded] = useState(false);
  const { position, status } = location;
  // gerundet, damit kleine GPS-Schwankungen keine neue Abfrage auslösen
  const lat = position ? roundCoord(position.lat) : null;
  const lon = position ? roundCoord(position.lon) : null;
  const { data, isPending, isError } = useQuery({
    queryKey: ["stops", "nearby", lat, lon],
    queryFn: ({ signal }) => nearbyStops(Number(lat), Number(lon), signal),
    enabled: lat !== null && lon !== null,
    staleTime: 10 * 60_000,
  });

  const ranked = position
    ? (data?.stops ?? [])
        .filter((s) => s.lat !== undefined && s.lon !== undefined)
        .map((stop) => ({
          stop,
          km: distanceKm(position, { lat: stop.lat ?? 0, lon: stop.lon ?? 0 }),
        }))
        .toSorted((a, b) => a.km - b.km)
    : [];
  const visible = expanded ? ranked : ranked.slice(0, NEARBY_VISIBLE);

  let message: string | null = null;
  if (status === "denied") message = "Standort nicht freigegeben (Browser-Einstellungen).";
  else if (status === "unavailable") message = "Standort gerade nicht verfügbar.";
  else if (status === "locating") message = "Standort wird ermittelt …";
  else if (status === "on" && isPending) message = "Haltestellen werden geladen …";
  else if (status === "on" && isError) message = "Gerade nicht verfügbar. Bitte später erneut.";
  else if (status === "on" && ranked.length === 0)
    message = "Keine Haltestelle im Umkreis von 1 km.";

  return (
    <section aria-labelledby="nearby-title" className="space-y-2">
      <h2 id="nearby-title" className="text-lg font-semibold tracking-tight">
        In der Nähe
      </h2>
      {status === "off" ? (
        <Button variant="outline" size="sm" onClick={location.toggle}>
          <LocateFixed aria-hidden="true" />
          Haltestellen in meiner Nähe zeigen
        </Button>
      ) : message ? (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {message}
        </p>
      ) : (
        <>
          <ul
            aria-label="Haltestellen in der Nähe"
            className="divide-y overflow-hidden rounded-lg border"
          >
            {visible.map(({ stop, km }) => (
              <li key={stop.id}>
                <StopRow stop={stop} distanceKm={km} />
              </li>
            ))}
          </ul>
          {ranked.length > NEARBY_VISIBLE && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Weniger anzeigen" : `Alle ${ranked.length} anzeigen`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
