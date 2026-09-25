interface Entry<T> {
    value: T;
    expiresAt: number;
}

interface CacheStore {
    entries: Map<string, Entry<unknown>>;
    inflight: Map<string, Promise<unknown>>;
}

const globalForCache = globalThis as unknown as { __pathpulseQueryCache?: CacheStore };

const store: CacheStore = (globalForCache.__pathpulseQueryCache ??= {
    entries: new Map(),
    inflight: new Map(),
});

/** Counts drift slowly; five minutes keeps the grid honest without the stall. */
export const COUNT_TTL_MS = 5 * 60 * 1000;

/** Class sizes drive a query-plan decision, so they may be staler still. */
export const CLASS_SIZE_TTL_MS = 30 * 60 * 1000;

const MAX_ENTRIES = 500;

function prune() {
    if (store.entries.size <= MAX_ENTRIES) return;
    const now = Date.now();
    for (const [key, entry] of store.entries) {
        if (entry.expiresAt <= now) store.entries.delete(key);
    }
    // Still oversized: drop oldest-inserted first (Map preserves insertion order).
    while (store.entries.size > MAX_ENTRIES) {
        const oldest = store.entries.keys().next().value;
        if (oldest === undefined) break;
        store.entries.delete(oldest);
    }
}

/**
 * Cached value for `key`, computing it via `load` on a miss.
 *
 * Concurrent misses for the same key share ONE in-flight promise, so six
 * reviewers landing on a cold filter at once trigger a single 9-second count
 * rather than six of them.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = store.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) {
        return hit.value as T;
    }

    const existing = store.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = load()
        .then((value) => {
            store.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
            prune();
            return value;
        })
        .finally(() => {
            store.inflight.delete(key);
        });

    store.inflight.set(key, promise);
    return promise;
}

/** Read a cached value without computing it. */
export function peek<T>(key: string): T | undefined {
    const hit = store.entries.get(key);
    return hit && hit.expiresAt > Date.now() ? (hit.value as T) : undefined;
}

/** Drop entries whose key contains `fragment`; used after a write invalidates counts. */
export function invalidate(fragment: string) {
    for (const key of store.entries.keys()) {
        if (key.includes(fragment)) store.entries.delete(key);
    }
}
