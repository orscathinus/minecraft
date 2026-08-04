package dev.orscathinus.cavegame.util;

/**
 * Converts variable frame times into a bounded number of fixed simulation updates.
 * Rendering can run once per frame regardless of the update count.
 */
public final class FixedStepTimer {
    private static final double EPSILON = 1.0e-12;

    private final double stepSeconds;
    private final double maxFrameDeltaSeconds;
    private final int maxUpdatesPerFrame;

    private double previousTimeSeconds;
    private double accumulatorSeconds;
    private boolean initialized;

    public FixedStepTimer(
            double updatesPerSecond,
            double maxFrameDeltaSeconds,
            int maxUpdatesPerFrame
    ) {
        if (!Double.isFinite(updatesPerSecond) || updatesPerSecond <= 0.0) {
            throw new IllegalArgumentException("updatesPerSecond must be finite and positive");
        }
        if (!Double.isFinite(maxFrameDeltaSeconds) || maxFrameDeltaSeconds <= 0.0) {
            throw new IllegalArgumentException("maxFrameDeltaSeconds must be finite and positive");
        }
        if (maxUpdatesPerFrame <= 0) {
            throw new IllegalArgumentException("maxUpdatesPerFrame must be positive");
        }

        this.stepSeconds = 1.0 / updatesPerSecond;
        this.maxFrameDeltaSeconds = maxFrameDeltaSeconds;
        this.maxUpdatesPerFrame = maxUpdatesPerFrame;
    }

    public void reset(double currentTimeSeconds) {
        requireFiniteTime(currentTimeSeconds);
        previousTimeSeconds = currentTimeSeconds;
        accumulatorSeconds = 0.0;
        initialized = true;
    }

    public Frame advance(double currentTimeSeconds) {
        requireFiniteTime(currentTimeSeconds);
        if (!initialized) {
            reset(currentTimeSeconds);
            return new Frame(0.0, 0.0, 0, 0.0, false);
        }

        double rawDeltaSeconds = Math.max(currentTimeSeconds - previousTimeSeconds, 0.0);
        previousTimeSeconds = currentTimeSeconds;

        double acceptedDeltaSeconds = Math.min(rawDeltaSeconds, maxFrameDeltaSeconds);
        accumulatorSeconds += acceptedDeltaSeconds;

        int updateCount = 0;
        while (accumulatorSeconds + EPSILON >= stepSeconds
                && updateCount < maxUpdatesPerFrame) {
            accumulatorSeconds -= stepSeconds;
            updateCount++;
        }

        boolean discardedBacklog = accumulatorSeconds + EPSILON >= stepSeconds;
        if (discardedBacklog) {
            accumulatorSeconds %= stepSeconds;
        }
        if (accumulatorSeconds < 0.0 && accumulatorSeconds > -EPSILON) {
            accumulatorSeconds = 0.0;
        }

        double interpolationAlpha = accumulatorSeconds / stepSeconds;
        return new Frame(
                rawDeltaSeconds,
                acceptedDeltaSeconds,
                updateCount,
                interpolationAlpha,
                discardedBacklog
        );
    }

    public double stepSeconds() {
        return stepSeconds;
    }

    private static void requireFiniteTime(double timeSeconds) {
        if (!Double.isFinite(timeSeconds)) {
            throw new IllegalArgumentException("timeSeconds must be finite");
        }
    }

    public record Frame(
            double rawDeltaSeconds,
            double acceptedDeltaSeconds,
            int updateCount,
            double interpolationAlpha,
            boolean discardedBacklog
    ) {
    }
}
