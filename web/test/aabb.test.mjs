import test from "node:test";
import assert from "node:assert/strict";
import { createAabb, intersectsAabb } from "../aabb.mjs";

test("overlapping AABBs intersect", () => {
    const player = createAabb(0.2, 1, 0.2, 0.8, 2.62, 0.8);
    const block = createAabb(0, 2, 0, 1, 3, 1);
    assert.equal(intersectsAabb(player, block), true);
});

test("touching AABBs do not count as penetration", () => {
    const left = createAabb(0, 0, 0, 1, 1, 1);
    const right = createAabb(1, 0, 0, 2, 1, 1);
    assert.equal(intersectsAabb(left, right), false);
});

test("separated AABBs do not intersect", () => {
    const first = createAabb(0, 0, 0, 1, 1, 1);
    const second = createAabb(2, 2, 2, 3, 3, 3);
    assert.equal(intersectsAabb(first, second), false);
});
