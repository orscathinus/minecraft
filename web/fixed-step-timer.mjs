const EPSILON = 1.0e-12;

/**
 * Converts variable animation-frame timestamps into bounded fixed updates.
 * Rendering still occurs once per requestAnimationFrame callback.
 */
export class FixedStepTimer {
    #stepSeconds;
    #maxFrameDeltaSeconds;
    #maxUpdatesPerFrame;
    #previousTimeSeconds = 0;
    #accumulatorSeconds = 0;
    #initialized = false;

    constructor({
        updatesPerSecond = 60,
        maxFrameDeltaSeconds = 0.25,
        maxUpdatesPerFrame = 5,
    } = {}) {
        if (!Number.isFinite(updatesPerSecond) || updatesPerSecond <= 0) {
            throw new RangeError("updatesPerSecond must be finite and positive");
        }
        if (!Number.isFinite(maxFrameDeltaSeconds) || maxFrameDeltaSeconds <= 0) {
            throw new RangeError("maxFrameDeltaSeconds must be finite and positive");
        }
        if (!Number.isInteger(maxUpdatesPerFrame) || maxUpdatesPerFrame <= 0) {
            throw new RangeError("maxUpdatesPerFrame must be a positive integer");
        }

        this.#stepSeconds = 1 / updatesPerSecond;
        this.#maxFrameDeltaSeconds = maxFrameDeltaSeconds;
        this.#maxUpdatesPerFrame = maxUpdatesPerFrame;
    }

    get stepSeconds() {
        return this.#stepSeconds;
    }

    reset(timestampMilliseconds) {
        const currentTimeSeconds = toFiniteSeconds(timestampMilliseconds);
        this.#previousTimeSeconds = currentTimeSeconds;
        this.#accumulatorSeconds = 0;
        this.#initialized = true;
    }

    advance(timestampMilliseconds) {
        const currentTimeSeconds = toFiniteSeconds(timestampMilliseconds);
        if (!this.#initialized) {
            this.reset(timestampMilliseconds);
            return Object.freeze({
                rawDeltaSeconds: 0,
                acceptedDeltaSeconds: 0,
                updateCount: 0,
                interpolationAlpha: 0,
                discardedBacklog: false,
            });
        }

        const rawDeltaSeconds = Math.max(
            currentTimeSeconds - this.#previousTimeSeconds,
            0,
        );
        this.#previousTimeSeconds = currentTimeSeconds;

        const acceptedDeltaSeconds = Math.min(
            rawDeltaSeconds,
            this.#maxFrameDeltaSeconds,
        );
        this.#accumulatorSeconds += acceptedDeltaSeconds;

        let updateCount = 0;
        while (
            this.#accumulatorSeconds + EPSILON >= this.#stepSeconds
            && updateCount < this.#maxUpdatesPerFrame
        ) {
            this.#accumulatorSeconds -= this.#stepSeconds;
            updateCount += 1;
        }

        const discardedBacklog =
            this.#accumulatorSeconds + EPSILON >= this.#stepSeconds;
        if (discardedBacklog) {
            this.#accumulatorSeconds %= this.#stepSeconds;
        }
        if (this.#accumulatorSeconds < 0 && this.#accumulatorSeconds > -EPSILON) {
            this.#accumulatorSeconds = 0;
        }

        return Object.freeze({
            rawDeltaSeconds,
            acceptedDeltaSeconds,
            updateCount,
            interpolationAlpha: this.#accumulatorSeconds / this.#stepSeconds,
            discardedBacklog,
        });
    }
}

function toFiniteSeconds(timestampMilliseconds) {
    if (!Number.isFinite(timestampMilliseconds)) {
        throw new TypeError("timestampMilliseconds must be finite");
    }
    return timestampMilliseconds / 1000;
}
