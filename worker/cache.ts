import { API_PREFIX } from "../shared/base-path";

/**
 * Kurzzeit-Cache über die Cache API (funktioniert auch auf workers.dev, getestet 13.11.2026).
 * Mehrere Nutzer an derselben Haltestelle teilen sich so eine Abfrage bei der Quelle.
 */
export async function cached<T>(
  request: Request,
  ctx: ExecutionContext,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const cache = caches.default;
  const cacheKey = new Request(
    new URL(`${API_PREFIX}__cache/${encodeURIComponent(key)}`, request.url).toString(),
  );

  const hit = await cache.match(cacheKey);
  if (hit) return hit.json<T>();

  const value = await load();
  ctx.waitUntil(
    cache.put(
      cacheKey,
      Response.json(value, { headers: { "Cache-Control": `max-age=${ttlSeconds}` } }),
    ),
  );
  return value;
}
