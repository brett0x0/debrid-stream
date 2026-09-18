import fs from 'fs';
import path from 'path';
import { Redis } from 'ioredis';
export class PersistentCache {
    redis = null;
    filePath;
    memoryMap = new Map();
    saveDebounceTimer = null;
    constructor(redisUrl, storageDir = './data') {
        this.filePath = path.join(storageDir, 'cache.json');
        if (redisUrl) {
            try {
                this.redis = new Redis(redisUrl, {
                    lazyConnect: true,
                    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 2000)),
                });
                this.redis.connect().catch(() => {
                    this.redis = null;
                });
            }
            catch {
                this.redis = null;
            }
        }
        if (!this.redis) {
            this.initFileStore(storageDir);
        }
    }
    initFileStore(storageDir) {
        try {
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(raw);
                const now = Date.now();
                for (const [k, v] of Object.entries(parsed)) {
                    const entry = v;
                    if (!entry.expiresAt || entry.expiresAt > now) {
                        this.memoryMap.set(k, entry);
                    }
                }
            }
        }
        catch {
            // Ignore file reading errors, start with clean map
        }
    }
    scheduleSave() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
            this.persistToFile();
        }, 2000);
    }
    persistToFile() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }
        try {
            const now = Date.now();
            const obj = {};
            for (const [k, v] of this.memoryMap.entries()) {
                if (!v.expiresAt || v.expiresAt > now) {
                    obj[k] = v;
                }
            }
            fs.writeFileSync(this.filePath, JSON.stringify(obj), 'utf-8');
        }
        catch {
            // Ignore disk writing errors
        }
    }
    async get(key) {
        if (this.redis) {
            try {
                const val = await this.redis.get(key);
                return val ? JSON.parse(val) : null;
            }
            catch {
                // Fallback to local
            }
        }
        const entry = this.memoryMap.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.memoryMap.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        if (this.redis) {
            try {
                const json = JSON.stringify(value);
                if (ttlSeconds) {
                    await this.redis.set(key, json, 'EX', ttlSeconds);
                }
                else {
                    await this.redis.set(key, json);
                }
                return;
            }
            catch {
                // Fallback to local
            }
        }
        this.memoryMap.set(key, { value, expiresAt });
        this.scheduleSave();
    }
    async delete(key) {
        if (this.redis) {
            try {
                await this.redis.del(key);
            }
            catch { }
        }
        this.memoryMap.delete(key);
        this.scheduleSave();
    }
    async clear() {
        if (this.redis) {
            try {
                await this.redis.flushdb();
            }
            catch { }
        }
        this.memoryMap.clear();
        this.persistToFile();
    }
}
