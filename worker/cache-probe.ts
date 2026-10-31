// Diagnose: Funktioniert die Cache API auf dieser Domain (z. B. *.workers.dev)?
// Der erste Aufruf legt einen Eintrag für 60 s ab, weitere Aufrufe melden einen Treffer.
const PROBE_TTL_SECONDS = 60;

export async function cacheProbe(request: Request, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default;
  const key = new Request(new URL("/api/cache-probe", request.url).toString());

  const hit = await cache.match(key);
  if (hit) {
    const { storedAt } = await hit.json<{ storedAt: string }>();
    return Response.json({ cache: "hit", storedAt }, { headers: { "Cache-Control": "no-store" } });
  }

  const storedAt = new Date().toISOString();
  ctx.waitUntil(
    cache.put(
      key,
      Response.json({ storedAt }, { headers: { "Cache-Control": `max-age=${PROBE_TTL_SECONDS}` } }),
    ),
  );
  return Response.json({ cache: "miss", storedAt }, { headers: { "Cache-Control": "no-store" } });
}
