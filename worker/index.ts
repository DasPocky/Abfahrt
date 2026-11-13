import { API_PREFIX, BASE_PATH } from "../shared/base-path";
import { cacheProbe } from "./cache-probe";
import { withSecurityHeaders } from "./security-headers";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

async function handleApi(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const { pathname } = new URL(request.url);
  switch (pathname.slice(API_PREFIX.length)) {
    case "health":
      return json({ status: "ok" });
    case "cache-probe":
      return cacheProbe(request, ctx);
    default:
      return json({ error: "not_found" }, { status: 404 });
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
