import { LRUCache } from 'lru-cache';
export class MemoryCache {
    cache;
    constructor(maxItems = 5000, defaultTtlMs = 1000 * 60 * 30) {
        this.cache = new LRUCache({
            max: maxItems,
            ttl: defaultTtlMs,
        });
    }
    async get(key) {
        const val = this.cache.get(key);
        return val !== undefined ? val : null;
    }
    async set(key, value, ttlSeconds) {
        const ttl = ttlSeconds ? ttlSeconds * 1000 : undefined;
        this.cache.set(key, value, { ttl });
    }
    async delete(key) {
        this.cache.delete(key);
    }
    async clear() {
        this.cache.clear();
    }
}
