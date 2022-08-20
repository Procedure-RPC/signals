/**
 * A helper class to create an {@link AbortSignal} which aborts as soon as any of the signals passed to its constructor do.
 */
export class AggregateSignal {
    #abortedSignal?: AbortSignal;

    /** The aggregate {@link AbortSignal}. */
    public readonly signal?: AbortSignal;

    /** The first {@link AbortSignal} of those passed in to have aborted. */
    get abortedSignal() { return this.#abortedSignal }

    /**
     * Initializes a new {@link AggregateSignal}.
     * @param {(AbortSignal | undefined)[]} abortSignals The {@link AbortSignal AbortSignals} to aggregate.
     */
    constructor(...abortSignals: (AbortSignal | undefined)[]) {
        const signals = abortSignals.filter(isSignal);

        if (signals.length === 1) {
            this.#abortedSignal = this.signal = signals[0];
        } else if (signals.some(s => s.aborted)) {
            this.#abortedSignal = this.signal = signals.filter(s => s.aborted)[0];
        } else if (signals.length > 1) {
            const ac = new AbortController();
            this.signal = ac.signal;

            for (const signal of signals) {
                signal.addEventListener('abort', () => {
                    for (const signal of signals) {
                        signal.removeEventListener('abort');
                    }

                    this.#abortedSignal = signal;
                    ac.abort();
                });
            }
        }
    }
}

/**
 * A helper class to create an {@link AbortSignal} based on a timeout.
 */
export class TimeoutSignal {
    /** The underlying {@link AbortSignal}. */
    public readonly signal?: AbortSignal;
    /** If defined, the ID of a timeout which will signal abortion. */
    public readonly timeout?: ReturnType<typeof setTimeout>;

    /**
     * Initializes a new {@link TimeoutSignal}.
     * @param {number} [timeout] The number of milliseconds after which the {@link signal} should be aborted.
     * `undefined`, {@link Infinity infinite} or {@link NaN} values will result in {@link signal} being `undefined`.
     * Finite values will be clamped between `0` and {@link Number.MAX_SAFE_INTEGER} inclusive.
     */
    constructor(timeout?: number) {
        if (timeout !== undefined && isFinite(timeout) && !isNaN(timeout)) {
            timeout = Math.min(Math.max(timeout, 0), Number.MAX_SAFE_INTEGER); // clamp the timeout to a sensible range

            const ac = new AbortController();
            this.signal = ac.signal; // wrap the AbortController's signal
            this.timeout = setTimeout(() => ac.abort(), timeout); // abort after the given number of milliseconds
        }
    }
}

/**
 * Type guard for determining whether a given {@link object} is an {@link AbortSignal} instance.
 * @param {unknown} object The object.
 * @returns {object is AbortSignal} `true` if {@link object} is determined to be an {@link AbortSignal}, otherwise `false`.
 */
export function isAbortSignal(object: unknown): object is AbortSignal {
    return object instanceof AbortSignal;
}

/**
 * A helpful interface to allow use of {@link AbortSignal AbortSignal's} {@link EventTarget} interface when TypeScript hates us.
 */
export interface Signal extends AbortSignal {
    addEventListener: (event: 'abort', callback: () => void) => void;
    removeEventListener: (event: 'abort') => void;
}

/**
 * Type guard for determining whether a given {@link object} conforms to the {@link Signal} interface.
 * @param {unknown} object The object.
 * @returns {object is Signal} `true` if {@link object} conforms to the {@link Signal} interface, otherwise `false`.
 */
export function isSignal(object: unknown): object is Signal {
    return isAbortSignal(object) && 'addEventListener' in object && 'removeEventListener' in object
        && typeof (<Signal>object).addEventListener === 'function' && typeof (<Signal>object).removeEventListener === 'function';
}
