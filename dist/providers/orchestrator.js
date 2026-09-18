import { CircuitBreaker } from './circuitBreaker.js';
import { ReleaseParser } from '../parser/releaseParser.js';
import { MetadataNormalizer } from '../metadata/normalizer.js';
import { Deduplicator } from '../ranking/deduplicator.js';
import { env } from '../config/env.js';
import { logger } from '../observability/logger.js';
export class ProviderOrchestrator {
    providers = new Map();
    breakers = new Map();
    constructor(providers = []) {
        for (const provider of providers) {
            this.registerProvider(provider);
        }
    }
    registerProvider(provider) {
        this.providers.set(provider.name, provider);
        this.breakers.set(provider.name, new CircuitBreaker({
            callTimeoutMs: env.PROVIDER_TIMEOUT_MS,
            failureThreshold: 3,
            resetTimeoutMs: 60000,
        }));
    }
    getProvider(name) {
        return this.providers.get(name);
    }
    /**
     * Concurrently searches all enabled providers, isolates failures,
     * normalizes releases, parses torrent metadata, and deduplicates results.
     */
    async search(meta, config) {
        const tasks = [];
        for (const [name, provider] of this.providers.entries()) {
            // Check if provider is enabled by user
            if (config.enabledProviders.length > 0 && !config.enabledProviders.includes(name)) {
                continue;
            }
            // Check if provider supports this media type
            if (!provider.supportedTypes.includes(meta.type)) {
                continue;
            }
            const breaker = this.breakers.get(name);
            tasks.push((async () => {
                const t0 = Date.now();
                const cand = await breaker.execute(async () => {
                    if (meta.type === 'movie') {
                        return await provider.searchMovie(meta);
                    }
                    else {
                        return await provider.searchSeries(meta);
                    }
                }, [] // Fallback on failure or timeout
                );
                logger.info({ provider: name, count: cand.length, durationMs: Date.now() - t0 }, 'Provider search completed');
                return cand;
            })());
        }
        const settled = await Promise.allSettled(tasks);
        const allCandidates = [];
        for (const res of settled) {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                allCandidates.push(...res.value);
            }
        }
        // Parse each candidate and check matching
        const matchedCandidates = [];
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
        logger.info({
            type: meta.type,
            rawCandidates: allCandidates.length,
            matchedCandidates: matchedCandidates.length,
            title: meta.title
        }, 'Candidates filtered');
        // Deduplicate
        return Deduplicator.deduplicate(matchedCandidates);
    }
    /**
     * Returns live health report for all registered providers.
     */
    async getHealthReport() {
        const tasks = [];
        for (const [name, provider] of this.providers.entries()) {
            const breaker = this.breakers.get(name);
            tasks.push(new Promise((resolve) => {
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
            }));
        }
        const results = await Promise.allSettled(tasks);
        const report = [];
        for (const r of results) {
            if (r.status === 'fulfilled') {
                report.push(r.value);
            }
        }
        return report;
    }
}
