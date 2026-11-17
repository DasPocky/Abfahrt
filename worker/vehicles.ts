// GET /abfahrt/api/vehicles?min=<lat,lon>&max=<lat,lon> – Fahrzeuge im Kartenausschnitt (#92)
import type { VehiclesResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json } from "./http";
import { vehiclesInArea } from "./sources/transitous-vehicles";
import { MAX_AREA_LAT, MAX_AREA_LON, parseArea } from "./stops-area";

/** Zeitfenster ab der vollen Minute; die App lädt jede Minute neu und rechnet dazwischen selbst */
export const VEHICLE_WINDOW_MINUTES = 3;
/** Eine Antwort je Ausschnitt und Minute, geteilt von allen Nutzern (schont Transitous) */
const VEHICLES_TTL = 90;

export async function getVehicles(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
  now = new Date(),
): Promise<Response> {
  const area = parseArea(params);
  if (!area) {
    return apiError(
      400,
      "invalid_area",
      `Ausschnitt als min=<lat,lon>&max=<lat,lon>, höchstens ${MAX_AREA_LAT}° × ${MAX_AREA_LON}°`,
    );
  }
  const from = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const to = new Date(from.getTime() + VEHICLE_WINDOW_MINUTES * 60_000);
  const box = [area.minLat, area.minLon, area.maxLat, area.maxLon].map((v) => v.toFixed(3));
  const key = `vehicles:v1:${box.join(",")}:${from.toISOString()}`;
  const segments = await cached(request, ctx, key, VEHICLES_TTL, () =>
    vehiclesInArea(area, from, to),
  );
  const body: VehiclesResponse = { segments, from: from.toISOString(), to: to.toISOString() };
  return json(body, { headers: { "Cache-Control": "public, max-age=30" } });
}
