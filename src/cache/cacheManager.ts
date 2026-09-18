import { MemoryCache } from './memoryCache.js';
import { PersistentCache } from './persistentCache.js';
import { env } from '../config/env.js';

export class CacheManager {
  private l1: MemoryCache;
  private l2: PersistentCache;

  constructor(redisUrl: string = env.REDIS_URL || '', storageDir: string = './data') {
    this.l1 = new MemoryCache(10000, 1000 * 60 * 60);
    this.l2 = new PersistentCache(redisUrl, storageDir);
  }

  /**
   * Deterministic key generator for L3 provider search results.
   */
  public static getProviderSearchKey(type: string, id: string): string {
    return `l3:prov:${type}:${id.toLowerCase()}`;
  }

  /**
   * Deterministic key generator for L4 Real-Debrid instant availability.
   */
  public static getRdAvailabilityKey(infoHash: string): string {
    return `l4:rd:avail:${infoHash.toLowerCase()}`;
  }

  /**
   * Deterministic key generator for L4 Real-Debrid resolved stream URL.
   */
  public static getRdStreamKey(infoHash: string, fileIdx: number = 0): string {
    return `l4:rd:stream:${infoHash.toLowerCase()}:${fileIdx}`;
  }

  /**
   * Deterministic key generator for complete rendered Stremio stream responses.
   */
  public static getFullStreamKey(type: string, id: string, configHash: string): string {
    return `l3:stream:full:${type}:${id.toLowerCase()}:${configHash}`;
  }

  /**
   * Deterministic key generator for Real-Debrid active/completed torrents.
   */
  public static getUserTorrentsKey(tokenHash: string): string {
    return `l4:rd:usertorrents:${tokenHash}`;
  }

  /**
   * Deterministic key generator for Cinemeta media metadata.
   */
  public static getCinemetaKey(type: string, id: string): string {
    return `l3:cinemeta:${type}:${id.toLowerCase()}`;
  }

  public async get<T>(key: string): Promise<T | null> {
    // 1. Check L1 Memory Cache
    const l1Val = await this.l1.get<T>(key);
    if (l1Val !== null) {
      return l1Val;
    }

    // 2. Check L2 Persistent Cache
    const l2Val = await this.l2.get<T>(key);
    if (l2Val !== null) {
      // Re-populate L1
      await this.l1.set(key, l2Val, 600); // 10 min in L1
      return l2Val;
    }

    return null;
  }

  public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    await this.l1.set(key, value, ttlSeconds);
    await this.l2.set(key, value, ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    await this.l1.delete(key);
    await this.l2.delete(key);
  }

  public async clear(): Promise<void> {
    await this.l1.clear();
    await this.l2.clear();
  }

  public async flush(): Promise<void> {
    this.l2.persistToFile();
  }

  /**
   * Stale-while-revalidate / wrap helper.
   */
  public async wrap<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 3600): Promise<T> {
    const cached = await this.get<T>(key);
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
