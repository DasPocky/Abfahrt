import type { ApiError } from "../shared/api-types";

/** Identifiziert die App gegenüber den Datenquellen (Pflicht laut Transitous-Policy). */
export const USER_AGENT = "Abfahrt/0.1 (+https://github.com/DasPocky/Abfahrt)";

const UPSTREAM_TIMEOUT_MS = 8000;

export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

export function apiError(status: number, error: string, message?: string): Response {
  const body: ApiError = message ? { error, message } : { error };
  return json(body, { status });
}

export async function fetchJson<T>(source: string, url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamError(source, err instanceof Error ? err.message : "Netzwerkfehler");
  }
  if (!res.ok) throw new UpstreamError(source, `HTTP ${res.status}`);
  return res.json<T>();
}
