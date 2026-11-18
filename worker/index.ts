import { getTrip } from "./trip";
import { API_PREFIX, BASE_PATH } from "../shared/base-path";
import { getDepartures, nearbyStops, searchStops } from "./api";
import { getAlerts } from "./alerts";
import { cacheProbe } from "./cache-probe";
import { getJourneys } from "./journeys";
import { runPushCron } from "./push/cron";
import { handlePush, PUSH_ROUTES } from "./push/routes";
import { apiError, json, UpstreamError } from "./http";
import { isRateLimited } from "./rate-limit";
import { PAGE_SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";
import { getStopsInArea } from "./stops-area";
import { getVehicles } from "./vehicles";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const route = url.pathname.slice(API_PREFIX.length);
  // Push hat eigene Methoden (POST); alles andere ist nur lesend
  if (!ALLOWED_METHODS.has(request.method) && !PUSH_ROUTES.has(route)) {
    return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (route === "health") return json({ status: "ok" });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (isRateLimited(ip)) {
    return apiError(429, "rate_limited", "Zu viele Anfragen, bitte kurz warten");
  }

  try {
    switch (route) {
      case "stops/search":
        return await searchStops(request, ctx, url.searchParams);
      case "stops/area":
        return await getStopsInArea(request, ctx, url.searchParams);
      case "stops/nearby":
        return await nearbyStops(request, ctx, url.searchParams);
      case "push/key":
      case "push/subscribe":
      case "push/unsubscribe":
      case "push/test":
      case "push/topics":
        return await handlePush(request, env, route);
      case "vehicles":
        return await getVehicles(request, ctx, url.searchParams);
      case "alerts":
        return await getAlerts(request, ctx, url.searchParams);
      case "journeys":
        return await getJourneys(request, ctx, url.searchParams);
      case "departures":
        return await getDepartures(request, ctx, url.searchParams);
      case "trip":
        return await getTrip(request, ctx, url.searchParams);
      case "cache-probe":
        return await cacheProbe(request, ctx);
      default:
        return apiError(404, "not_found");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return apiError(404, "stop_not_found", "Haltestelle nicht gefunden");
    }
    console.error(err);
    if (err instanceof UpstreamError) {
      return apiError(502, "upstream_unavailable", "Datenquelle gerade nicht erreichbar");
    }
    return apiError(500, "internal_error");
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(API_PREFIX)) {
      return withSecurityHeaders(await handleApi(request, env, ctx));
    }
    // /abfahrt ohne Schrägstrich: auf /abfahrt/ weiterleiten, damit relative Pfade stimmen
    if (url.pathname === BASE_PATH) {
      url.pathname = `${BASE_PATH}/`;
      return withSecurityHeaders(Response.redirect(url.toString(), 301));
    }
    // App-Seiten (/abfahrt/haltestelle/…, /abfahrt/verbindung, …) liefert der Worker selbst als
    // index.html aus. Grund (#76): Die Static Assets antworten Browsern bei Pfaden mit „%3A“ mit
    // einer 307-Weiterleitung auf dieselbe Adresse (Endlosschleife). Dateien unter
    // /abfahrt/assets/ usw. kommen weiter direkt aus den Assets (siehe run_worker_first).
    if (
      url.pathname.startsWith(`${BASE_PATH}/`) &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const index = await env.ASSETS.fetch(
        new Request(new URL("/", url), { method: request.method, headers: request.headers }),
      );
      return withSecurityHeaders(index, PAGE_SECURITY_HEADERS);
    }
    return env.ASSETS.fetch(request);
  },

  /** Cron (wrangler.jsonc „triggers“): Push-Auslöser alle 5 Minuten (#72) */
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(runPushCron(env, ctx).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
