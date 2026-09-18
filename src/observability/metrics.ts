export interface AddonMetrics {
  totalRequests: number;
  streamRequests: number;
  resolveRequests: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  uptimeSeconds: number;
}

export class MetricsCollector {
  private startTime = Date.now();
  private totalRequests = 0;
  private streamRequests = 0;
  private resolveRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private errors = 0;

  public incrementTotal(): void {
    this.totalRequests++;
  }

  public incrementStream(): void {
    this.streamRequests++;
  }

  public incrementResolve(): void {
    this.resolveRequests++;
  }

  public recordCacheHit(): void {
    this.cacheHits++;
  }

  public recordCacheMiss(): void {
    this.cacheMisses++;
  }

  public incrementErrors(): void {
    this.errors++;
  }

  public getMetrics(): AddonMetrics {
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
