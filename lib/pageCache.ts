// In-memory cache that survives client-side navigation (cleared on full page refresh)
const cache: Record<string, { data: unknown; ts: number }> = {};
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { delete cache[key]; return null; }
  return entry.data as T;
}

export function setCached(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

export function invalidateCache(key: string) {
  delete cache[key];
}
