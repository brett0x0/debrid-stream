export class MetricsCollector {
    startTime = Date.now();
    totalRequests = 0;
    streamRequests = 0;
    resolveRequests = 0;
    cacheHits = 0;
    cacheMisses = 0;
    errors = 0;
    incrementTotal() {
        this.totalRequests++;
    }
    incrementStream() {
        this.streamRequests++;
    }
    incrementResolve() {
        this.resolveRequests++;
    }
    recordCacheHit() {
        this.cacheHits++;
    }
    recordCacheMiss() {
        this.cacheMisses++;
    }
    incrementErrors() {
        this.errors++;
    }
    getMetrics() {
        return {
            totalRequests: this.totalRequests,
            streamRequests: this.streamRequests,
            resolveRequests: this.resolveRequests,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            errors: this.errors,
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        };
    }
}
export const metrics = new MetricsCollector();
