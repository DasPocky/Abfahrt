// Fahrtverlauf (#120): `/api/trip?ref=…` liefert eine Fahrt mit allen Halten, Echtzeit und Strecke.
import type { DataSource, JourneyLeg, TripResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json } from "./http";
import { withLineColors } from "./journeys";
import { REGIONAL_SOURCES } from "./sources/regional";
import { tripLeg } from "./sources/transitous-trips";
import { BASE as VRR_BASE } from "./sources/vrr";
import { efaTripLeg } from "./sources/vrr-trips";
import { parseTripRef, type TripRef } from "./trip-ref";

/** Wie die Abfahrten: Echtzeit ändert sich laufend */
const TRIP_TTL = 30;

function efaBase(source: string): string | null {
  if (source === "vrr") return VRR_BASE;
  return REGIONAL_SOURCES.find((s) => s.key === source)?.base ?? null;
}

async function loadLeg(ref: TripRef): Promise<{ leg: JourneyLeg | null; source: DataSource }> {
  if (ref.kind === "transitous") return { leg: await tripLeg(ref.tripId), source: "transitous" };
  const base = efaBase(ref.source);
  return { leg: base ? await efaTripLeg(base, ref.source, ref) : null, source: ref.source };
}

export async function getTrip(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const raw = params.get("ref");
  const ref = parseTripRef(raw);
  if (!ref) return apiError(400, "invalid_trip", "Ungültiger Verweis auf die Fahrt");

  const result = await cached<TripResponse | null>(
    request,
    ctx,
    `trip:v1:${raw}`,
    TRIP_TTL,
    async () => {
      const { leg, source } = await loadLeg(ref);
      if (!leg) return null;
      // VRR liefert keine Linienfarben: wie bei den Verbindungen aus Transitous ergänzen
      const [colored] = await withLineColors(request, ctx, [
        { id: "trip", legs: [leg], transfers: 0, durationMinutes: leg.durationMinutes },
      ]);
      return { leg: colored?.legs[0] ?? leg, source, generatedAt: new Date().toISOString() };
    },
  );
  if (!result) return apiError(404, "trip_not_found", "Fahrt nicht gefunden");
  return json(result, { headers: { "Cache-Control": "public, max-age=15" } });
}
