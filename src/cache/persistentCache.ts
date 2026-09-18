import fs from 'fs';
import path from 'path';
import { Redis } from 'ioredis';
import { CacheStore } from './cacheInterface.js';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class PersistentCache implements CacheStore {
  private redis: Redis | null = null;
  private filePath: string;
  private memoryMap: Map<string, CacheEntry<any>> = new Map();
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(redisUrl?: string, storageDir: string = './data') {
    this.filePath = path.join(storageDir, 'cache.json');

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 100, 2000)),
        });
        this.redis.connect().catch(() => {
          this.redis = null;
        });
      } catch {
        this.redis = null;
      }
    }

    if (!this.redis) {
      this.initFileStore(storageDir);
    }
  }

  private initFileStore(storageDir: string): void {
    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          const entry = v as CacheEntry<any>;
          if (!entry.expiresAt || entry.expiresAt > now) {
            this.memoryMap.set(k, entry);
          }
        }
      }
    } catch {
      // Ignore file reading errors, start with clean map
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.persistToFile();
    }, 2000);
  }

  public persistToFile(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    try {
      const now = Date.now();
      const obj: Record<string, CacheEntry<any>> = {};
      for (const [k, v] of this.memoryMap.entries()) {
        if (!v.expiresAt || v.expiresAt > now) {
          obj[k] = v;
        }
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj), 'utf-8');
    } catch {
      // Ignore disk writing errors
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const val = await this.redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        // Fallback to local
      }
    }

    const entry = this.memoryMap.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.memoryMap.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;

    if (this.redis) {
      try {
        const json = JSON.stringify(value);
        if (ttlSeconds) {
          await this.redis.set(key, json, 'EX', ttlSeconds);
        } else {
          await this.redis.set(key, json);
        }
        return;
      } catch {
        // Fallback to local
      }
    }

    this.memoryMap.set(key, { value, expiresAt });
    this.scheduleSave();
  }

  public async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {}
    }
    this.memoryMap.delete(key);
    this.scheduleSave();
  }

  public async clear(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.flushdb();
      } catch {}
    }
    this.memoryMap.clear();
    this.persistToFile();
  }
}
