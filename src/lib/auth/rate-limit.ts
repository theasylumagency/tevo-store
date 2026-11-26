import "server-only";

/**
 * Small in-memory limiter (one app instance). Enough to stop password guessing on /admin/login;
 * replace with Redis/Postgres if the store ever runs on several instances.
 */
const hits = new Map<string, { n: number; first: number }>();

export function tooManyAttempts(key: string, max = 5, windowMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.first > windowMs) return false;
  return h.n >= max;
}

export function recordFailure(key: string, windowMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.first > windowMs) hits.set(key, { n: 1, first: now });
  else h.n++;
  if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);
}

export function clearFailures(key: string) {
  hits.delete(key);
}
