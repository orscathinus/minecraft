package dev.orscathinus.cavegame.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class FixedStepTimerTest {
    private static final double TOLERANCE = 1.0e-9;

    @Test
    void usesSixtyUpdatesPerSecond() {
        FixedStepTimer timer = new FixedStepTimer(60.0, 0.25, 5);

        assertEquals(1.0 / 60.0, timer.stepSeconds(), TOLERANCE);
    }

    @Test
    void accumulatesPartialFramesAndExposesInterpolation() {
        FixedStepTimer timer = new FixedStepTimer(60.0, 0.25, 5);
        timer.reset(10.0);

        FixedStepTimer.Frame first = timer.advance(10.010);
        FixedStepTimer.Frame second = timer.advance(10.020);

        assertEquals(0, first.updateCount());
        assertEquals(0.6, first.interpolationAlpha(), TOLERANCE);
        assertEquals(1, second.updateCount());
        assertEquals(0.2, second.interpolationAlpha(), TOLERANCE);
    }

    @Test
    void capsCatchUpWorkAndDiscardsRemainingSpiral() {
        FixedStepTimer timer = new FixedStepTimer(60.0, 0.25, 5);
        timer.reset(1.0);

        FixedStepTimer.Frame frame = timer.advance(6.0);

        assertEquals(5.0, frame.rawDeltaSeconds(), TOLERANCE);
        assertEquals(0.25, frame.acceptedDeltaSeconds(), TOLERANCE);
        assertEquals(5, frame.updateCount());
        assertTrue(frame.discardedBacklog());
        assertTrue(frame.interpolationAlpha() >= 0.0);
        assertTrue(frame.interpolationAlpha() < 1.0);
    }

    @Test
    void aBackwardClockDoesNotCreateNegativeSimulationTime() {
        FixedStepTimer timer = new FixedStepTimer(60.0, 0.25, 5);
        timer.reset(5.0);

        FixedStepTimer.Frame frame = timer.advance(4.0);

        assertEquals(0.0, frame.rawDeltaSeconds(), TOLERANCE);
        assertEquals(0, frame.updateCount());
        assertFalse(frame.discardedBacklog());
    }

    @Test
    void validatesConfigurationAndClockValues() {
        assertThrows(IllegalArgumentException.class,
                () -> new FixedStepTimer(0.0, 0.25, 5));
        assertThrows(IllegalArgumentException.class,
                () -> new FixedStepTimer(60.0, 0.0, 5));
        assertThrows(IllegalArgumentException.class,
                () -> new FixedStepTimer(60.0, 0.25, 0));

        FixedStepTimer timer = new FixedStepTimer(60.0, 0.25, 5);
        assertThrows(IllegalArgumentException.class, () -> timer.reset(Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> timer.advance(Double.POSITIVE_INFINITY));
    }
}
