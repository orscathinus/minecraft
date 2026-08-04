import assert from "node:assert/strict";
import test from "node:test";

import { FixedStepTimer } from "../fixed-step-timer.mjs";

test("initial advance produces no update", () => {
    const timer = new FixedStepTimer();
    const frame = timer.advance(1000);

    assert.equal(frame.updateCount, 0);
    assert.equal(frame.interpolationAlpha, 0);
});

test("sixty updates per second produces one update per step", () => {
    const timer = new FixedStepTimer({ updatesPerSecond: 60 });
    timer.reset(0);

    const frame = timer.advance(1000 / 60);

    assert.equal(frame.updateCount, 1);
    assert.ok(frame.interpolationAlpha >= 0);
    assert.ok(frame.interpolationAlpha < 1);
});

test("render interpolation preserves partial time", () => {
    const timer = new FixedStepTimer({ updatesPerSecond: 60 });
    timer.reset(0);

    const frame = timer.advance(1000 / 120);

    assert.equal(frame.updateCount, 0);
    assert.ok(Math.abs(frame.interpolationAlpha - 0.5) < 1.0e-9);
});

test("large pauses are clamped and update catch-up is bounded", () => {
    const timer = new FixedStepTimer({
        updatesPerSecond: 60,
        maxFrameDeltaSeconds: 0.25,
        maxUpdatesPerFrame: 5,
    });
    timer.reset(0);

    const frame = timer.advance(10_000);

    assert.equal(frame.rawDeltaSeconds, 10);
    assert.equal(frame.acceptedDeltaSeconds, 0.25);
    assert.equal(frame.updateCount, 5);
    assert.equal(frame.discardedBacklog, true);
    assert.ok(frame.interpolationAlpha >= 0);
    assert.ok(frame.interpolationAlpha < 1);
});

test("backward timestamps do not create negative time", () => {
    const timer = new FixedStepTimer();
    timer.reset(2000);

    const frame = timer.advance(1000);

    assert.equal(frame.rawDeltaSeconds, 0);
    assert.equal(frame.acceptedDeltaSeconds, 0);
    assert.equal(frame.updateCount, 0);
});
