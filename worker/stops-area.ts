// GET /abfahrt/api/stops/area?min=<lat,lon>&max=<lat,lon> – Haltestellen im Kartenausschnitt
import type { Stop, StopSearchResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json } from "./http";
import { stopsInArea, type Area } from "./sources/transitous-map";

const AREA_TTL = 24 * 60 * 60;
/** Größter erlaubter Ausschnitt (nur bei ausreichendem Zoom, schont Transitous) */
export const MAX_AREA_LAT = 0.05;
export const MAX_AREA_LON = 0.08;

function parsePoint(value: string | null): [number, number] | null {
  const match = /^(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/.exec(value ?? "");
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

const down = (v: number) => Math.floor(v * 1000) / 1000;
const up = (v: number) => Math.ceil(v * 1000) / 1000;

/**
 * Prüft den Ausschnitt und rundet ihn nach außen auf 3 Nachkommastellen (ca. 100 m). Der
 * gerundete Ausschnitt ist Cache-Schlüssel und Anfrage an Transitous zugleich.
 */
export function parseArea(params: URLSearchParams): Area | null {
  const min = parsePoint(params.get("min"));
  const max = parsePoint(params.get("max"));
  if (!min || !max) return null;
  const [minLat, minLon] = min;
  const [maxLat, maxLon] = max;
  if (maxLat <= minLat || maxLon <= minLon) return null;
  // kleine Toleranz für Rundungsfehler der App
  if (maxLat - minLat > MAX_AREA_LAT + 1e-9 || maxLon - minLon > MAX_AREA_LON + 1e-9) return null;
  return { minLat: down(minLat), minLon: down(minLon), maxLat: up(maxLat), maxLon: up(maxLon) };
}

export async function getStopsInArea(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const area = parseArea(params);
  if (!area) {
    return apiError(
      400,
      "invalid_area",
      `Ausschnitt als min=<lat,lon>&max=<lat,lon>, höchstens ${MAX_AREA_LAT}° × ${MAX_AREA_LON}°`,
    );
  }
  const key = `area:v2:${[area.minLat, area.minLon, area.maxLat, area.maxLon].map((v) => v.toFixed(3)).join(",")}`;
  const stops = await cached<Stop[]>(request, ctx, key, AREA_TTL, () => stopsInArea(area));
  const body: StopSearchResponse = { stops };
  return json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
