import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { AlertRow } from "@/components/alert-list";
import { Chip } from "@/components/chip";
import { SourceAttribution } from "@/components/source-attribution";
import { StopPicker } from "@/components/stop-picker";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { useLocation } from "@/hooks/use-location";
import { useNow } from "@/hooks/use-now";
import {
  ALERTS_STALE_MS,
  affectsAnyFavorite,
  alertModes,
  filterAlertsByModes,
  sortAlerts,
  stopAlertsKey,
} from "@/lib/alerts";
import { fetchAlerts, nearbyStops, roundCoord } from "@/lib/api";
import { distanceKm } from "@/lib/geo";
import { MODE_SHORT } from "@/lib/modes";
import { formatClock } from "@/lib/time";
import type { TransportMode } from "../../shared/api-types";
import { usePageTitle } from "@/hooks/use-page-title";

/** Ohne Favorit und Standort: Düsseldorf */
export const DEFAULT_AREA = "5111000";
const DEFAULT_AREA_NAME = "Düsseldorf";

type Origin =
  | { kind: "stop"; id: string; name: string; via: "Auswahl" | "Favorit" | "in der Nähe" }
  | { kind: "area"; area: string }
  | { kind: "waiting" };

const isVrr = (id: string) => id.startsWith("vrr:");

/** Übersicht der Störungen einer Gemeinde, gewählt über eine Haltestelle */
export function AlertsPage() {
  usePageTitle("Störungen");
  const [params, setParams] = useSearchParams();
  const { favorites } = useFavorites();
  const location = useLocation();
  const now = useNow(60_000);
  const [mode, setMode] = useState<TransportMode | null>(null);

  const chosenId = params.get("halt");
  const useHere = params.get("standort") === "1";
  const favoriteStop = useHere ? undefined : favorites.find((f) => isVrr(f.stopId));

  // Nächste VRR-Haltestelle (gleicher Cache wie „In der Nähe“)
  const { position, status } = location;
  const lat = position ? roundCoord(position.lat) : null;
  const lon = position ? roundCoord(position.lon) : null;
  const wantsNearby = chosenId === null && favoriteStop === undefined;
  const nearby = useQuery({
    queryKey: ["stops", "nearby", lat, lon],
    queryFn: ({ signal }) => nearbyStops(Number(lat), Number(lon), signal),
    enabled: wantsNearby && lat !== null && lon !== null,
    staleTime: 10 * 60_000,
  });
  const nearest = position
    ? (nearby.data?.stops ?? [])
        .filter((s) => isVrr(s.id) && s.lat !== undefined && s.lon !== undefined)
        .map((stop) => ({
          stop,
          km: distanceKm(position, { lat: stop.lat ?? 0, lon: stop.lon ?? 0 }),
        }))
        .toSorted((a, b) => a.km - b.km)[0]?.stop
    : undefined;

  let origin: Origin;
  if (chosenId !== null) {
    origin = { kind: "stop", id: chosenId, name: params.get("name") ?? "", via: "Auswahl" };
  } else if (favoriteStop) {
    origin = { kind: "stop", id: favoriteStop.stopId, name: favoriteStop.name, via: "Favorit" };
  } else if (nearest) {
    origin = { kind: "stop", id: nearest.id, name: nearest.name, via: "in der Nähe" };
  } else if (status === "locating" || (status === "on" && nearby.isPending)) {
    origin = { kind: "waiting" };
  } else {
    origin = { kind: "area", area: DEFAULT_AREA };
  }

  const stopId = origin.kind === "stop" ? origin.id : null;
  const stopSupported = stopId !== null && isVrr(stopId);
  // Erst über die Haltestelle die Gemeinde holen, dann alle Meldungen der Gemeinde
  const stopQuery = useQuery({
    queryKey: stopAlertsKey(stopId ?? ""),
    queryFn: ({ signal }) => fetchAlerts({ stop: stopId ?? "" }, signal),
    enabled: stopSupported,
    staleTime: ALERTS_STALE_MS,
  });
  const area =
    origin.kind === "area" ? origin.area : stopSupported ? stopQuery.data?.area || null : null;
  const areaQuery = useQuery({
    queryKey: ["alerts", "area", area],
    queryFn: ({ signal }) => fetchAlerts({ area: area ?? "" }, signal),
    enabled: area !== null,
    staleTime: ALERTS_STALE_MS,
  });

  const data = areaQuery.data;
  const areaName =
    data?.areaName ??
    stopQuery.data?.areaName ??
    (area === DEFAULT_AREA ? DEFAULT_AREA_NAME : null);
  const sorted = sortAlerts(data?.alerts ?? []);
  const modes = alertModes(sorted);
  const activeMode = mode !== null && modes.includes(mode) ? mode : null;
  const shown = filterAlertsByModes(sorted, activeMode ? [activeMode] : []);
  // Favoriten zuerst, innerhalb beider Gruppen bleibt die Sortierung
  const marked = shown.map((alert) => ({ alert, favorite: affectsAnyFavorite(alert, favorites) }));
  const ordered = [...marked.filter((m) => m.favorite), ...marked.filter((m) => !m.favorite)];

  const loading =
    origin.kind === "waiting" ||
    (stopSupported && stopQuery.isPending) ||
    (area !== null && areaQuery.isPending);
  const failed = stopQuery.isError || areaQuery.isError;

  function pickStop(id: string, name: string) {
    setMode(null);
    setParams({ halt: id, name }, { replace: true });
  }
  function pickLocation() {
    setMode(null);
    setParams({ standort: "1" }, { replace: true });
    if (status !== "on" && status !== "locating") location.toggle();
  }

  const sourceLine =
    origin.kind === "stop" && origin.name ? `über ${origin.name} (${origin.via})` : null;

  return (
    <section aria-labelledby="alerts-title" className="space-y-3">
      <div>
        <h1 id="alerts-title" className="text-2xl font-semibold tracking-tight">
          Störungen{areaName ? ` in ${areaName}` : ""}
        </h1>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {sourceLine}
          {sourceLine && data && " · "}
          {data && (
            <>
              Stand{" "}
              <time dateTime={data.generatedAt}>{formatClock(new Date(data.generatedAt))}</time>
            </>
          )}
        </p>
      </div>

      <div className="rounded-lg border">
        <StopPicker
          label="Gemeinde über eine Haltestelle wählen"
          placeholder="Anderer Ort: Haltestelle suchen"
          value={null}
          location={location}
          locating={useHere && status === "locating"}
          onSelect={(stop) => pickStop(stop.id, stop.name)}
          onPickLocation={pickLocation}
        />
      </div>

      {modes.length > 0 && (
        <div
          role="group"
          aria-label="Nach Verkehrsmittel filtern"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5"
        >
          <Chip active={activeMode === null} onClick={() => setMode(null)}>
            Alle
          </Chip>
          {modes.map((m) => (
            <Chip key={m} active={activeMode === m} onClick={() => setMode(m)}>
              {MODE_SHORT[m]}
            </Chip>
          ))}
        </div>
      )}

      {loading ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Störungen werden geladen …
        </p>
      ) : failed && !data ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm">
          <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
          <p>Störungen konnten nicht geladen werden.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void (stopQuery.isError ? stopQuery.refetch() : areaQuery.refetch())}
          >
            Erneut versuchen
          </Button>
        </div>
      ) : !data || ordered.length === 0 ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
        >
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
          {stopId !== null && !stopSupported
            ? "Für diese Haltestelle gibt es keine Meldungen (nur im VRR)."
            : activeMode
              ? "Keine Meldungen für dieses Verkehrsmittel."
              : "Keine Störungen gemeldet."}
        </p>
      ) : (
        <>
          <p className="sr-only" role="status">
            {ordered.length === 1 ? "1 Meldung" : `${ordered.length} Meldungen`}
          </p>
          <ul aria-label="Störungen" className="divide-y overflow-hidden rounded-lg border">
            {ordered.map(({ alert, favorite }) => (
              <li key={alert.id}>
                <AlertRow alert={alert} now={now} favorite={favorite} />
              </li>
            ))}
          </ul>
        </>
      )}

      {data && <SourceAttribution source={data.source} />}
    </section>
  );
}
