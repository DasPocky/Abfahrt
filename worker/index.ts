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
  switch (pathname) {
    case "/api/health":
      return json({ status: "ok" });
    case "/api/cache-probe":
      return cacheProbe(request, ctx);
    default:
      return json({ error: "not_found" }, { status: 404 });
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(await handleApi(request, ctx));
    }
    // Wird nur erreicht, falls ein Nicht-API-Pfad den Worker trifft
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
