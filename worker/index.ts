import { API_PREFIX, BASE_PATH } from "../shared/base-path";
import { getDepartures, searchStops } from "./api";
import { cacheProbe } from "./cache-probe";
import { apiError, json, UpstreamError } from "./http";
import { isRateLimited } from "./rate-limit";
import { withSecurityHeaders } from "./security-headers";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

async function handleApi(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const route = url.pathname.slice(API_PREFIX.length);
  if (route === "health") return json({ status: "ok" });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (isRateLimited(ip)) {
    return apiError(429, "rate_limited", "Zu viele Anfragen, bitte kurz warten");
  }

  try {
    switch (route) {
      case "stops/search":
        return await searchStops(request, ctx, url.searchParams);
      case "departures":
        return await getDepartures(request, ctx, url.searchParams);
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
      return withSecurityHeaders(await handleApi(request, ctx));
    }
    // /abfahrt ohne Schrägstrich: auf /abfahrt/ weiterleiten, damit relative Pfade stimmen
    if (url.pathname === BASE_PATH) {
      url.pathname = `${BASE_PATH}/`;
      return withSecurityHeaders(Response.redirect(url.toString(), 301));
    }
    // Wird nur erreicht, falls ein anderer Pfad den Worker trifft
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
