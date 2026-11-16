import type { Alert, AlertsResponse } from "../shared/api-types";
import { cached } from "./cache";
import { apiError, json } from "./http";
import { normalizeLineName } from "./line-colors";
import { areaAlerts, cityName, municipalityOf } from "./sources/vrr-alerts";

const STOP_ID = /^(vrr|transitous):[A-Za-z0-9:_.-]{1,160}$/;
const AREA = /^\d{7}$/;
const LINE = /^[\p{L}\d ._-]{1,16}$/u;
const MAX_LINES = 20;
/** Meldungen ändern sich selten; alle Nutzer einer Gemeinde teilen sich eine Abfrage */
const ALERTS_TTL = 5 * 60;
/** Haltestelle → Gemeinde ändert sich praktisch nie */
const MUNICIPALITY_TTL = 30 * 24 * 60 * 60;

/** Meldungen, die die Haltestelle oder eine der Linien betreffen */
export function filterAlerts(
  alerts: readonly Alert[],
  stopId: string | null,
  lines: readonly string[],
): Alert[] {
  if (!stopId && lines.length === 0) return [...alerts];
  const wanted = new Set(lines.map(normalizeLineName));
  return alerts.filter(
    (a) =>
      (stopId !== null && a.stops.some((s) => s.id === stopId)) ||
      a.lines.some((l) => wanted.has(normalizeLineName(l.line))),
  );
}

function parseLines(value: string | null): string[] | null {
  if (!value) return [];
  const lines = value
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > MAX_LINES || !lines.every((l) => LINE.test(l))) return null;
  return lines;
}

export async function getAlerts(
  request: Request,
  ctx: ExecutionContext,
  params: URLSearchParams,
): Promise<Response> {
  const stop = params.get("stop");
  const area = params.get("area");
  const lines = parseLines(params.get("lines"));
  if (lines === null) return apiError(400, "invalid_lines", "Höchstens 20 gültige Linien angeben");
  if (stop !== null && !STOP_ID.test(stop)) {
    return apiError(400, "invalid_stop", "Ungültige Haltestellen-ID");
  }
  if (area !== null && !AREA.test(area)) {
    return apiError(400, "invalid_area", "Gemeindeschlüssel mit 7 Ziffern angeben");
  }
  if (stop === null && area === null) {
    return apiError(400, "invalid_area", "Haltestelle oder Gemeinde angeben");
  }

  const generatedAt = new Date().toISOString();
  // Nur VRR-Haltestellen haben (bisher) Meldungen
  if (stop !== null && !stop.startsWith("vrr:")) {
    const body: AlertsResponse = {
      area: "",
      areaName: null,
      alerts: [],
      source: "vrr",
      generatedAt,
    };
    return json(body);
  }

  let omc = area;
  let areaName = area ? cityName(area) : null;
  if (omc === null && stop !== null) {
    const dhid = stop.slice("vrr:".length).split(":").slice(0, 3).join(":");
    const municipality = await cached(request, ctx, `omc:v1:${dhid}`, MUNICIPALITY_TTL, () =>
      municipalityOf(dhid),
    );
    if (!municipality) return apiError(404, "stop_not_found", "Haltestelle nicht gefunden");
    omc = municipality.omc;
    areaName = municipality.name;
  }
  if (omc === null) return apiError(400, "invalid_area", "Haltestelle oder Gemeinde angeben");

  const all = await cached(request, ctx, `alerts:v2:${omc}`, ALERTS_TTL, () => areaAlerts(omc));
  const stopId =
    stop === null ? null : `vrr:${stop.slice("vrr:".length).split(":").slice(0, 3).join(":")}`;
  const body: AlertsResponse = {
    area: omc,
    areaName,
    alerts: filterAlerts(all, stopId, lines),
    source: "vrr",
    generatedAt,
  };
  return json(body, { headers: { "Cache-Control": "public, max-age=120" } });
}
