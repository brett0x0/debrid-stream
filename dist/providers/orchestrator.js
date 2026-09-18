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
        const corePriority = ['tpb', 'yts', 'eztv', 'torrentgalaxy', '1337x', 'rarbg'];
        const sortedEntries = Array.from(this.providers.entries()).sort(([a], [b]) => {
            const aIdx = corePriority.indexOf(a);
            const bIdx = corePriority.indexOf(b);
            const aWeight = aIdx === -1 ? 99 : aIdx;
            const bWeight = bIdx === -1 ? 99 : bIdx;
            return aWeight - bWeight;
        });
        const activeTasks = [];
        for (const [name, provider] of sortedEntries) {
            // Check if provider is enabled by user
            if (config.enabledProviders.length > 0 && !config.enabledProviders.includes(name)) {
                continue;
            }
            // Check if provider supports this media type
            if (!provider.supportedTypes.includes(meta.type)) {
                continue;
            }
            const breaker = this.breakers.get(name);
            activeTasks.push((async () => {
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
        if (activeTasks.length === 0)
            return [];
        const allCandidates = [];
        const minCandidatesThreshold = 10;
        const fastCutoffMs = 1500;
        const hardTimeoutMs = env.PROVIDER_TIMEOUT_MS;
        const startTime = Date.now();
        await new Promise((resolve) => {
            let isDone = false;
            let completed = 0;
            const total = activeTasks.length;
            const finish = () => {
                if (!isDone) {
                    isDone = true;
                    clearTimeout(cutoffTimer);
                    clearTimeout(hardTimer);
                    resolve();
                }
            };
            const cutoffTimer = setTimeout(() => {
                const distinctProviders = new Set(allCandidates.map((c) => c.provider)).size;
                if (allCandidates.length >= 25 || (allCandidates.length >= minCandidatesThreshold && distinctProviders >= 2)) {
                    logger.info({ candidateCount: allCandidates.length, distinctProviders, elapsedMs: Date.now() - startTime }, 'Fast-cutoff triggered: returning diverse high-speed results');
                    finish();
                }
            }, fastCutoffMs);
            const hardTimer = setTimeout(() => {
                logger.info({ candidateCount: allCandidates.length, elapsedMs: Date.now() - startTime }, 'Provider search hit limit: returning gathered results');
                finish();
            }, hardTimeoutMs);
            for (const task of activeTasks) {
                task.then((res) => {
                    if (Array.isArray(res) && res.length > 0) {
                        allCandidates.push(...res);
                    }
                    completed++;
                    const distinctProviders = new Set(allCandidates.map((c) => c.provider)).size;
                    if (completed >= total) {
                        finish();
                    }
                    else if (Date.now() - startTime >= fastCutoffMs && (allCandidates.length >= 25 || (allCandidates.length >= minCandidatesThreshold && distinctProviders >= 2))) {
                        finish();
                    }
                }).catch(() => {
                    completed++;
                    if (completed >= total)
                        finish();
                });
            }
        });
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
