import { LRUCache } from 'lru-cache';
import { CacheStore } from './cacheInterface.js';

export class MemoryCache implements CacheStore {
  private cache: LRUCache<string, any>;

  constructor(maxItems: number = 5000, defaultTtlMs: number = 1000 * 60 * 30) {
    this.cache = new LRUCache({
      max: maxItems,
      ttl: defaultTtlMs,
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    const val = this.cache.get(key);
    return val !== undefined ? (val as T) : null;
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : undefined;
    this.cache.set(key, value, { ttl });
  }

  public async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  public async clear(): Promise<void> {
    this.cache.clear();
  }
}
