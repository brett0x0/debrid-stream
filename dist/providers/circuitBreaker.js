export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
export class CircuitBreaker {
    state = CircuitState.CLOSED;
    failureCount = 0;
    lastFailureTime = 0;
    failureThreshold;
    resetTimeoutMs;
    callTimeoutMs;
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold ?? 3;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 60000;
        this.callTimeoutMs = options.callTimeoutMs ?? 3500;
    }
    getState() {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
            }
        }
        return this.state;
    }
    async execute(action, fallback) {
        const currentState = this.getState();
        if (currentState === CircuitState.OPEN) {
            return fallback;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.callTimeoutMs);
        try {
            const result = await action(controller.signal);
            clearTimeout(timeoutId);
            this.onSuccess();
            return result;
        }
        catch {
            clearTimeout(timeoutId);
            this.onFailure();
            return fallback;
        }
    }
    onSuccess() {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold || this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
        }
    }
}
