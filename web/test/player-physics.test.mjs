import test from "node:test";
import assert from "node:assert/strict";
import { BlockType } from "../block-type.mjs";
import { Chunk } from "../chunk.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { FixedStepTimer } from "../fixed-step-timer.mjs";
import { movePlayerAabb, PlayerConfig, PlayerPhysics } from "../player-physics.mjs";
import { World } from "../world.mjs";

function makeWorld(blocks) {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(0, 0));
    for (const [x, y, z, type = BlockType.ROCK] of blocks) chunk.setBlock(x, y, z, type);
    world.addChunk(chunk);
    return world;
}

function floorWorld() {
    const blocks = [];
    for (let z = 0; z < 6; z += 1) {
        for (let x = 0; x < 6; x += 1) blocks.push([x, 0, z]);
    }
    return makeWorld(blocks);
}

test("falling resolves against a solid floor", () => {
    const movement = movePlayerAabb(floorWorld(), [1.5, 3, 1.5], [0, -5, 0]);
    assert.equal(movement.position[1], 1);
    assert.equal(movement.hitFloor, true);
    assert.equal(movement.grounded, true);
});

test("jumping resolves against a solid ceiling", () => {
    const world = makeWorld([[1, 3, 1]]);
    const movement = movePlayerAabb(world, [1.5, 1, 1.5], [0, 2, 0]);
    assert.ok(Math.abs(movement.position[1] - (3 - PlayerConfig.height)) < 1e-9);
    assert.equal(movement.hitCeiling, true);
    assert.equal(movement.hitFloor, false);
});

test("horizontal movement stops at a wall", () => {
    const world = makeWorld([[2,1,1],[2,2,1]]);
    const movement = movePlayerAabb(world, [1.5, 1, 1.5], [1, 0, 0]);
    assert.ok(Math.abs(movement.position[0] - 1.7) < 1e-9);
    assert.equal(movement.hitX, true);
});

test("diagonal movement slides along a wall", () => {
    const blocks = [];
    for (let z = 0; z < 5; z += 1) {
        blocks.push([2,1,z], [2,2,z]);
    }
    const movement = movePlayerAabb(makeWorld(blocks), [1.5, 1, 1.5], [1, 0, 1]);
    assert.ok(Math.abs(movement.position[0] - 1.7) < 1e-9);
    assert.ok(movement.position[2] > 2.45);
    assert.equal(movement.hitX, true);
    assert.equal(movement.hitZ, false);
});

test("ground state changes from standing to jumping to landing", () => {
    const player = new PlayerPhysics(floorWorld(), { position: [1.5, 1, 1.5] });
    player.update(1 / 60);
    assert.equal(player.grounded, true);

    const airborne = player.update(1 / 60, { jumpPressed: true });
    assert.equal(airborne.grounded, false);
    assert.ok(airborne.position[1] > 1);

    let landed = false;
    for (let index = 0; index < 180; index += 1) {
        const state = player.update(1 / 60);
        if (state.grounded) {
            landed = true;
            assert.ok(Math.abs(state.position[1] - 1) < 1e-9);
            break;
        }
    }
    assert.equal(landed, true);
});

test("fixed updates produce consistent movement at different render rates", () => {
    const at30Fps = simulateOneSecond(30);
    const at144Fps = simulateOneSecond(144);
    assert.equal(at30Fps.updates, 60);
    assert.equal(at144Fps.updates, 60);
    assert.ok(Math.abs(at30Fps.position[2] - at144Fps.position[2]) < 1e-9);
});

function simulateOneSecond(renderFramesPerSecond) {
    const player = new PlayerPhysics(floorWorld(), { position: [2.5, 1, 4.5] });
    player.update(1 / 60);
    const timer = new FixedStepTimer({ updatesPerSecond: 60, maxUpdatesPerFrame: 5 });
    timer.reset(0);
    let updates = 0;
    for (let frame = 1; frame <= renderFramesPerSecond; frame += 1) {
        const result = timer.advance(frame * 1000 / renderFramesPerSecond);
        for (let index = 0; index < result.updateCount; index += 1) {
            player.update(timer.stepSeconds, { forward: true });
            updates += 1;
        }
    }
    return { position: player.position, updates };
}
