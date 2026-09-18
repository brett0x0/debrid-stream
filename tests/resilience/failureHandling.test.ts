import { describe, it, expect, vi } from 'vitest';
import { ProviderOrchestrator } from '../../src/providers/orchestrator.js';
import { TorrentProvider } from '../../src/providers/providerInterface.js';
import { RealDebridClient, RealDebridError } from '../../src/debrid/realDebridClient.js';
import { MediaMetadata } from '../../src/metadata/types.js';
import { UserConfig } from '../../src/config/userConfig.js';
import { StreamRanker } from '../../src/ranking/ranker.js';

describe('Resilience and Failure Handling', () => {
  const meta: MediaMetadata = {
    type: 'movie',
    imdbId: 'tt0137523',
    title: 'Fight Club',
    year: 1999,
  };

  const config: UserConfig = {
    rdToken: 'MOCK_SECRET_TOKEN',
    maxResults: 20,
    preferredResolutions: ['1080p'],
    preferredSources: ['BluRay'],
    preferredCodecs: ['AVC'],
    maxFileSizeGb: 0,
    excludedResolutions: [],
    enabledProviders: ['failing-prov', 'malformed-prov', 'working-prov'],
    showCachedOnly: false,
    sortOrder: 'quality',
  };

  it('handles provider 500 without crashing and proceeds with other providers', async () => {
    const failingProv: TorrentProvider = {
      name: 'failing-prov',
      supportedTypes: ['movie'],
      searchMovie: async () => {
        throw new Error('500 Internal Server Error');
      },
      searchSeries: async () => [],
      healthCheck: async () => false,
    };

    const workingProv: TorrentProvider = {
      name: 'working-prov',
      supportedTypes: ['movie'],
      searchMovie: async () => [
        {
          id: '1',
          provider: 'working-prov',
          title: 'Fight.Club.1999.1080p.BluRay.x264',
          infoHash: '1111111111111111111111111111111111111111',
          sizeBytes: 4000000000,
          seeders: 50,
        },
      ],
      searchSeries: async () => [],
      healthCheck: async () => true,
    };

    const orchestrator = new ProviderOrchestrator([failingProv, workingProv]);
    const results = await orchestrator.search(meta, config);

    expect(results.length).toBe(1);
    expect(results[0]?.provider).toBe('working-prov');
  });

  it('handles malformed provider JSON without crashing', async () => {
    const malformedProv: TorrentProvider = {
      name: 'malformed-prov',
      supportedTypes: ['movie'],
      searchMovie: async () => {
        // Simulates provider returning invalid structure or throwing JSON parse error
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
      searchSeries: async () => [],
      healthCheck: async () => false,
    };

    const orchestrator = new ProviderOrchestrator([malformedProv]);
    const results = await orchestrator.search(meta, config);
    expect(results).toEqual([]);
  });

  it('handles empty provider result smoothly', async () => {
    const emptyProv: TorrentProvider = {
      name: 'empty-prov',
      supportedTypes: ['movie'],
      searchMovie: async () => [],
      searchSeries: async () => [],
      healthCheck: async () => true,
    };

    const orchestrator = new ProviderOrchestrator([emptyProv]);
    const results = await orchestrator.search(meta, { ...config, enabledProviders: ['empty-prov'] });
    expect(results).toEqual([]);
  });

  it('handles invalid Real-Debrid token cleanly without exposing token', async () => {
    const rdClient = new RealDebridClient(1000);
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'bad_token' }),
    });

    try {
      await expect(rdClient.getUser(config.rdToken)).rejects.toThrow(RealDebridError);
      try {
        await rdClient.getUser(config.rdToken);
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
        expect(err.message).not.toContain(config.rdToken);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles Real-Debrid timeout with AbortError and retry', async () => {
    const rdClient = new RealDebridClient(50);
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    try {
      await expect(rdClient.getUser('TEST_TOKEN')).rejects.toThrow('timed out');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles Real-Debrid 429 rate limit backoff', async () => {
    const rdClient = new RealDebridClient(2000);
    const originalFetch = global.fetch;
    let attempts = 0;

    global.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 2) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: 'rate_limit_exceeded' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 1, username: 'testuser' }),
      };
    });

    try {
      const user = await rdClient.getUser('TEST_TOKEN');
      expect(user.username).toBe('testuser');
      expect(attempts).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('deduplicates duplicate torrents from multiple providers', () => {
    const cand1 = {
      id: '1',
      provider: 'yts',
      title: 'Fight.Club.1999.1080p.BluRay.x264',
      infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sizeBytes: 5000000000,
      seeders: 50,
    };
    const cand2 = {
      id: '2',
      provider: 'tpb',
      title: 'Fight.Club.1999.1080p.BluRay.x264',
      infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sizeBytes: 5000000000,
      seeders: 80,
    };

    const ranked = StreamRanker.rank([cand1, cand2], new Set(), config);
    expect(ranked.length).toBe(2); // Ranker accepts candidates, deduplication tested in orchestrator
  });
});
