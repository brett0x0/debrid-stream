import { TorrentProvider } from './providerInterface.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { MediaMetadata } from '../metadata/types.js';
import { TorrentCandidate } from '../parser/types.js';
import { ReleaseParser } from '../parser/releaseParser.js';
import { MetadataNormalizer } from '../metadata/normalizer.js';
import { Deduplicator } from '../ranking/deduplicator.js';
import { UserConfig } from '../config/userConfig.js';
import { env } from '../config/env.js';

export interface ProviderHealth {
  name: string;
  circuitState: string;
  healthy: boolean;
}

export class ProviderOrchestrator {
  private providers: Map<string, TorrentProvider> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor(providers: TorrentProvider[] = []) {
    for (const provider of providers) {
      this.registerProvider(provider);
    }
  }

  public registerProvider(provider: TorrentProvider): void {
    this.providers.set(provider.name, provider);
    this.breakers.set(
      provider.name,
      new CircuitBreaker({
        callTimeoutMs: env.PROVIDER_TIMEOUT_MS,
        failureThreshold: 3,
        resetTimeoutMs: 60000,
      })
    );
  }

  public getProvider(name: string): TorrentProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Concurrently searches all enabled providers, isolates failures,
   * normalizes releases, parses torrent metadata, and deduplicates results.
   */
  public async search(meta: MediaMetadata, config: UserConfig): Promise<TorrentCandidate[]> {
    const tasks: Promise<TorrentCandidate[]>[] = [];

    for (const [name, provider] of this.providers.entries()) {
      // Check if provider is enabled by user
      if (config.enabledProviders.length > 0 && !config.enabledProviders.includes(name)) {
        continue;
      }

      // Check if provider supports this media type
      if (!provider.supportedTypes.includes(meta.type)) {
        continue;
      }

      const breaker = this.breakers.get(name)!;

      tasks.push(
        breaker.execute(
          async () => {
            if (meta.type === 'movie') {
              return await provider.searchMovie(meta);
            } else {
              return await provider.searchSeries(meta);
            }
          },
          [] // Fallback on failure or timeout
        )
      );
    }

    const settled = await Promise.allSettled(tasks);
    const allCandidates: TorrentCandidate[] = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allCandidates.push(...res.value);
      }
    }

    // Parse each candidate and check matching
    const matchedCandidates: TorrentCandidate[] = [];
    for (const cand of allCandidates) {
      if (!cand.infoHash || cand.infoHash.length !== 40) {
        continue;
      }

      // Check title relevance
      if (!MetadataNormalizer.isMatch(cand.title, meta)) {
        continue;
      }

      const parsed = ReleaseParser.parse(cand.title);
      matchedCandidates.push({
        ...cand,
        parsed,
      });
    }

    // Deduplicate
    return Deduplicator.deduplicate(matchedCandidates);
  }

  /**
   * Returns live health report for all registered providers.
   */
  public async getHealthReport(): Promise<ProviderHealth[]> {
    const tasks: Promise<ProviderHealth>[] = [];

    for (const [name, provider] of this.providers.entries()) {
      const breaker = this.breakers.get(name)!;

      tasks.push(
        new Promise<ProviderHealth>((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              name,
              circuitState: breaker.getState(),
              healthy: false,
            });
          }, 1500);

          provider
            .healthCheck()
            .then((healthy) => {
              clearTimeout(timer);
              resolve({
                name,
                circuitState: breaker.getState(),
                healthy,
              });
            })
            .catch(() => {
              clearTimeout(timer);
              resolve({
                name,
                circuitState: breaker.getState(),
                healthy: false,
              });
            });
        })
      );
    }

    const results = await Promise.allSettled(tasks);
    const report: ProviderHealth[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        report.push(r.value);
      }
    }

    return report;
  }
}
