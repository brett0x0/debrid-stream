import { MemoryCache } from './memoryCache.js';
import { PersistentCache } from './persistentCache.js';
import { env } from '../config/env.js';
export class CacheManager {
    l1;
    l2;
    constructor(redisUrl = env.REDIS_URL || '', storageDir = './data') {
        this.l1 = new MemoryCache(10000, 1000 * 60 * 60);
        this.l2 = new PersistentCache(redisUrl, storageDir);
    }
    /**
     * Deterministic key generator for L3 provider search results.
     */
    static getProviderSearchKey(type, id) {
        return `l3:prov:${type}:${id.toLowerCase()}`;
    }
    /**
     * Deterministic key generator for L4 Real-Debrid instant availability.
     */
    static getRdAvailabilityKey(infoHash) {
        return `l4:rd:avail:${infoHash.toLowerCase()}`;
    }
    /**
     * Deterministic key generator for L4 Real-Debrid resolved stream URL.
     */
    static getRdStreamKey(infoHash, fileIdx = 0) {
        return `l4:rd:stream:${infoHash.toLowerCase()}:${fileIdx}`;
    }
    async get(key) {
        // 1. Check L1 Memory Cache
        const l1Val = await this.l1.get(key);
        if (l1Val !== null) {
            return l1Val;
        }
        // 2. Check L2 Persistent Cache
        const l2Val = await this.l2.get(key);
        if (l2Val !== null) {
            // Re-populate L1
            await this.l1.set(key, l2Val, 600); // 10 min in L1
            return l2Val;
        }
        return null;
    }
    async set(key, value, ttlSeconds = 3600) {
        await this.l1.set(key, value, ttlSeconds);
        await this.l2.set(key, value, ttlSeconds);
    }
    async delete(key) {
        await this.l1.delete(key);
        await this.l2.delete(key);
    }
    async clear() {
        await this.l1.clear();
        await this.l2.clear();
    }
    async flush() {
        this.l2.persistToFile();
    }
    /**
     * Stale-while-revalidate / wrap helper.
     */
    async wrap(key, fetcher, ttlSeconds = 3600) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) {
            await this.set(key, fresh, ttlSeconds);
        }
        return fresh;
    }
}
export const defaultCache = new CacheManager();
