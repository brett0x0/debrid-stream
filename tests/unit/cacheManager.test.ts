import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager } from '../../src/cache/cacheManager.js';
import fs from 'fs';
import path from 'path';

describe('CacheManager', () => {
  const testStorageDir = './data/test-cache';
  let cache: CacheManager;

  beforeEach(async () => {
    cache = new CacheManager('', testStorageDir);
    await cache.clear();
  });

  it('sets and gets values across L1 and L2', async () => {
    await cache.set('test:key1', { movie: 'Fight Club' }, 60);

    const val = await cache.get<{ movie: string }>('test:key1');
    expect(val).not.toBeNull();
    expect(val?.movie).toBe('Fight Club');
  });

  it('generates deterministic cache keys', () => {
    const provKey = CacheManager.getProviderSearchKey('movie', 'tt0137523');
    expect(provKey).toBe('l3:prov:movie:tt0137523');

    const rdKey = CacheManager.getRdAvailabilityKey('ABCDEF123456789012345678901234567890ABCD');
    expect(rdKey).toBe('l4:rd:avail:abcdef123456789012345678901234567890abcd');

    const streamKey = CacheManager.getRdStreamKey('ABCDEF123456789012345678901234567890ABCD', 2);
    expect(streamKey).toBe('l4:rd:stream:abcdef123456789012345678901234567890abcd:2');
  });

  it('uses wrap helper to fetch once and return cached on subsequent calls', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount };
    };

    const first = await cache.wrap('test:counter', fetcher, 60);
    expect(first.count).toBe(1);

    const second = await cache.wrap('test:counter', fetcher, 60);
    expect(second.count).toBe(1); // Should return cached value without calling fetcher again
    expect(callCount).toBe(1);
  });

  it('persists data to disk and reloads on new instance', async () => {
    await cache.set('persistent:item', { persistent: true }, 60);
    await cache.flush();

    // Create a new instance pointing to same directory
    const newCache = new CacheManager('', testStorageDir);
    const val = await newCache.get<{ persistent: boolean }>('persistent:item');
    expect(val).not.toBeNull();
    expect(val?.persistent).toBe(true);

    // Cleanup test directory
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch {}
  });
});
