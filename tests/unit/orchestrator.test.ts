import { describe, it, expect } from 'vitest';
import { ProviderOrchestrator } from '../../src/providers/orchestrator.js';
import { TorrentProvider } from '../../src/providers/providerInterface.js';
import { MediaMetadata } from '../../src/metadata/types.js';
import { TorrentCandidate } from '../../src/parser/types.js';
import { UserConfig } from '../../src/config/userConfig.js';

describe('ProviderOrchestrator', () => {
  const sampleMeta: MediaMetadata = {
    type: 'movie',
    imdbId: 'tt0137523',
    title: 'Fight Club',
    year: 1999,
  };

  const sampleConfig: UserConfig = {
    rdToken: 'test-token',
    maxResults: 20,
    preferredResolutions: ['2160p', '1080p'],
    preferredSources: ['REMUX', 'BluRay'],
    preferredCodecs: ['HEVC', 'AVC'],
    maxFileSizeGb: 0,
    excludedResolutions: [],
    enabledProviders: ['healthy-provider', 'failing-provider', 'slow-provider'],
    showCachedOnly: true,
    sortOrder: 'quality',
  };

  it('runs providers in parallel and isolates failures and timeouts', async () => {
    const healthyProvider: TorrentProvider = {
      name: 'healthy-provider',
      supportedTypes: ['movie', 'series'],
      searchMovie: async () => [
        {
          id: '1',
          provider: 'healthy-provider',
          title: 'Fight.Club.1999.1080p.BluRay.x264',
          infoHash: '1111111111111111111111111111111111111111',
          sizeBytes: 8000000000,
          seeders: 50,
        },
      ],
      searchSeries: async () => [],
      healthCheck: async () => true,
    };

    const failingProvider: TorrentProvider = {
      name: 'failing-provider',
      supportedTypes: ['movie', 'series'],
      searchMovie: async () => {
        throw new Error('Database 500 error');
      },
      searchSeries: async () => [],
      healthCheck: async () => false,
    };

    const slowProvider: TorrentProvider = {
      name: 'slow-provider',
      supportedTypes: ['movie', 'series'],
      searchMovie: async () => {
        // Will be aborted by breaker if it exceeds call timeout
        await new Promise((r) => setTimeout(r, 6000));
        return [];
      },
      searchSeries: async () => [],
      healthCheck: async () => false,
    };

    const orchestrator = new ProviderOrchestrator([healthyProvider, failingProvider, slowProvider]);

    const results = await orchestrator.search(sampleMeta, sampleConfig);

    // Results must contain the healthy provider candidate
    expect(results.length).toBe(1);
    expect(results[0]?.title).toBe('Fight.Club.1999.1080p.BluRay.x264');
    expect(results[0]?.parsed?.resolution).toBe('1080p');
  });

  it('respects user config disabled providers', async () => {
    const providerA: TorrentProvider = {
      name: 'providerA',
      supportedTypes: ['movie'],
      searchMovie: async () => [
        {
          id: '1',
          provider: 'providerA',
          title: 'Fight.Club.1999.720p',
          infoHash: '2222222222222222222222222222222222222222',
          sizeBytes: 4000000000,
          seeders: 10,
        },
      ],
      searchSeries: async () => [],
      healthCheck: async () => true,
    };

    const orchestrator = new ProviderOrchestrator([providerA]);

    const restrictedConfig: UserConfig = {
      ...sampleConfig,
      enabledProviders: ['some-other-provider'], // providerA is excluded
    };

    const results = await orchestrator.search(sampleMeta, restrictedConfig);
    expect(results.length).toBe(0);
  });
});
