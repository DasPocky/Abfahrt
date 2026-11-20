import { handleSpeech, workersAiTranscriber } from "./speech";
import { getTrip } from "./trip";
import { API_PREFIX, HOME, OLD_HOST, OLD_PATH } from "../shared/base-path";
import { isNavigation, movePage, retireServiceWorker } from "./move";
import { getDepartures, nearbyStops, searchStops } from "./api";
import { getAlerts } from "./alerts";
import { cacheProbe } from "./cache-probe";
import { getJourneys } from "./journeys";
import { runPushCron } from "./push/cron";
import { handlePush, PUSH_ROUTES } from "./push/routes";
import { handleProfile, PROFILE_ROUTES } from "./profile";
import { ADMIN_ROUTES, handleAdmin, handleBanner, speechDailyMinutes } from "./admin";
import { apiError, json, UpstreamError } from "./http";
import { isRateLimited } from "./rate-limit";
import { PAGE_SECURITY_HEADERS, withSecurityHeaders } from "./security-headers";
import { getStopsInArea } from "./stops-area";
import { getVehicles } from "./vehicles";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const route = url.pathname.slice(API_PREFIX.length);
  // Push und Geräteprofil haben eigene Methoden (POST, PUT); alles andere ist nur lesend
  if (
    !ALLOWED_METHODS.has(request.method) &&
    !PUSH_ROUTES.has(route) &&
    !PROFILE_ROUTES.has(route) &&
    !ADMIN_ROUTES.has(route) &&
    route !== "speech"
  ) {
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
      case "profile":
      case "profile/create":
      case "profile/transfer":
      case "profile/claim":
        return await handleProfile(request, env, route);
      case "banner":
        return await handleBanner(env);
      case "verwaltung/stand":
      case "verwaltung/banner":
      case "verwaltung/sprache":
      case "verwaltung/profile":
      case "verwaltung/profile/loeschen":
      case "verwaltung/codes/zurueckziehen":
        return await handleAdmin(request, env, route);
      case "vehicles":
        return await getVehicles(request, ctx, url.searchParams);
      case "alerts":
        return await getAlerts(request, ctx, url.searchParams);
      case "journeys":
        return await getJourneys(request, ctx, url.searchParams);
      case "speech":
        return await handleSpeech(
          request,
          {
            db: env.PUSH_DB,
            dailyMinutes: await speechDailyMinutes(env),
            transcribe: workersAiTranscriber(env.AI),
          },
          ip,
        );
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

/** Pfad ohne das frühere Präfix /abfahrt, oder null, wenn er nicht darunter liegt */
function oldPath(path: string): string | null {
  if (path === OLD_PATH) return "/";
  return path.startsWith(`${OLD_PATH}/`) ? path.slice(OLD_PATH.length) : null;
}

/** Gebaute Dateien (Rest sind App-Seiten) */
function isStaticFile(path: string): boolean {
  return (
    path.startsWith("/assets/") ||
    path.startsWith("/icons/") ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest"
  );
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    // Frühere Adresse mit /abfahrt davor. Seiten ziehen um: von endlab.de samt Daten auf dem
    // Gerät nach abfahrt.endlab.de, sonst einfach an die Wurzel. Dateien und /api gibt es dort
    // weiter ohne Präfix, damit offene Tabs bis zum nächsten Neuladen laufen.
    const old = oldPath(url.pathname);
    if (old !== null) {
      if (url.hostname === OLD_HOST && old === "/sw.js") return retireServiceWorker();
      if (isNavigation(request) && !old.startsWith(API_PREFIX)) {
        if (url.hostname === OLD_HOST) return movePage(`${HOME}${old}${url.search}`);
        return withSecurityHeaders(Response.redirect(`${url.origin}${old}${url.search}`, 301));
      }
      url.pathname = old;
      request = new Request(url, request);
    }
    if (url.pathname.startsWith(API_PREFIX)) {
      return withSecurityHeaders(await handleApi(request, env, ctx));
    }
    if (isStaticFile(url.pathname)) return env.ASSETS.fetch(request);
    // App-Seiten (/haltestelle/…, /verbindung, …) liefert der Worker selbst als index.html aus.
    // Grund (#76): Die Static Assets antworten Browsern bei Pfaden mit „%3A“ mit einer
    // 307-Weiterleitung auf dieselbe Adresse (Endlosschleife). Dateien unter /assets/ usw. kommen
    // direkt aus den Assets (siehe run_worker_first).
    if (request.method === "GET" || request.method === "HEAD") {
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
