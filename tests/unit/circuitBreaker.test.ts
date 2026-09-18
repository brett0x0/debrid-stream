import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../src/providers/circuitBreaker.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('executes successful actions and stays CLOSED', async () => {
    const breaker = new CircuitBreaker();
    const result = await breaker.execute(async () => 'success', 'fallback');
    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('transitions to OPEN after exceeding failure threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, callTimeoutMs: 1000 });

    const failingAction = async () => {
      throw new Error('boom');
    };

    // First failure
    const r1 = await breaker.execute(failingAction, 'fallback');
    expect(r1).toBe('fallback');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Second failure -> opens circuit
    const r2 = await breaker.execute(failingAction, 'fallback');
    expect(r2).toBe('fallback');
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Immediate subsequent action should not even execute the action function
    const mockAction = vi.fn();
    const r3 = await breaker.execute(mockAction, 'short-circuit');
    expect(r3).toBe('short-circuit');
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('triggers fallback on timeout', async () => {
    const breaker = new CircuitBreaker({ callTimeoutMs: 50 });

    const slowAction = async (signal: AbortSignal) => {
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => resolve('done'), 500);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    };

    const result = await breaker.execute(slowAction, 'timeout-fallback');
    expect(result).toBe('timeout-fallback');
  });
});
