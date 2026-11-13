// Einfaches Rate-Limit pro IP und Isolate (best effort). Verhindert Massenabrufe über
// unsere API, wie es die VRR-Nutzungsvereinbarung (§6.2) verlangt.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const MAX_TRACKED = 5_000;

const hits = new Map<string, { start: number; count: number }>();

export function isRateLimited(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip);
  if (!entry || now - entry.start >= WINDOW_MS) {
    if (hits.size >= MAX_TRACKED) hits.clear();
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export function resetRateLimit(): void {
  hits.clear();
}
