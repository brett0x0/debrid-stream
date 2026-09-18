export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before opening circuit (default: 3)
  resetTimeoutMs?: number; // Cooldown before trying HALF_OPEN (default: 60000)
  callTimeoutMs?: number; // Timeout per call in ms (default: 3500)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly callTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60000;
    this.callTimeoutMs = options.callTimeoutMs ?? 3500;
  }

  public getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
      }
    }
    return this.state;
  }

  public async execute<T>(action: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      return fallback;
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Operation timed out after ${this.callTimeoutMs}ms`));
      }, this.callTimeoutMs);
    });

    try {
      const result = await Promise.race([action(controller.signal), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      this.onSuccess();
      return result;
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
      this.onFailure();
      return fallback;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold || this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    }
  }
}
