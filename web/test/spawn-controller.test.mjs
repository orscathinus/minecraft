import test from "node:test";
import assert from "node:assert/strict";
import { PlayerPhysics } from "../player-physics.mjs";
import {
    HistoricalSpawnController,
    readSpawnDebugSeed,
    SpawnConfig,
} from "../spawn-controller.mjs";
import { World } from "../world.mjs";

test("fixed debug seeds produce deterministic spawn sequences", () => {
    const first = new HistoricalSpawnController({ debugSeed: 123456 });
    const second = new HistoricalSpawnController({ debugSeed: 123456 });
    const firstSequence = [];
    const secondSequence = [];
    for (let index = 0; index < 20; index += 1) {
        firstSequence.push(first.createInitialSpawn().position);
        secondSequence.push(second.createInitialSpawn().position);
    }
    assert.deepEqual(firstSequence, secondSequence);
});

test("every initial spawn and respawn uses Y=74 and finite-map X/Z block centers", () => {
    const controller = new HistoricalSpawnController({ debugSeed: 98765 });
    const body = fakeBody();
    const spawns = [controller.createInitialSpawn()];
    for (let index = 0; index < 100; index += 1) {
        spawns.push(controller.respawnPlayer(body).spawn);
    }
    for (const spawn of spawns) {
        assert.equal(spawn.position[1], SpawnConfig.y);
        assert.ok(spawn.position[0] >= 0.5 && spawn.position[0] <= 255.5);
        assert.ok(spawn.position[2] >= 0.5 && spawn.position[2] <= 255.5);
        assert.equal(spawn.position[0] % 1, 0.5);
        assert.equal(spawn.position[2] % 1, 0.5);
    }
});

test("respawning resets horizontal and vertical velocity", () => {
    const world = new World();
    const player = new PlayerPhysics(world, { position: [20.5, 74, 20.5] });
    const moving = player.update(1 / 60, { forward: true, right: true });
    assert.notDeepEqual(moving.velocity, [0, 0, 0]);

    const controller = new HistoricalSpawnController({ debugSeed: 42 });
    const result = controller.respawnPlayer(player);
    assert.equal(result.state.position[1], 74);
    assert.deepEqual(result.state.velocity, [0, 0, 0]);
    assert.equal(result.state.grounded, false);
});

test("held state respawns every fixed update and release stops respawning", () => {
    const controller = new HistoricalSpawnController({ debugSeed: 777 });
    const body = fakeBody();
    for (let update = 0; update < 6; update += 1) {
        assert.notEqual(controller.updateHeld(body, true), null);
    }
    assert.equal(body.calls.length, 6);
    assert.equal(controller.snapshot().respawnCount, 6);

    for (let update = 0; update < 10; update += 1) {
        assert.equal(controller.updateHeld(body, false), null);
    }
    assert.equal(body.calls.length, 6);
    assert.equal(controller.snapshot().respawnCount, 6);

    controller.updateHeld(body, true);
    assert.equal(body.calls.length, 7);
    assert.equal(controller.snapshot().respawnCount, 7);
});

test("R-style respawn works from far below the finite world", () => {
    const player = new PlayerPhysics(new World(), { position: [400.5, -500000, -200.5] });
    player.update(1 / 60, { forward: true });
    const controller = new HistoricalSpawnController({ debugSeed: 2026 });
    const result = controller.updateHeld(player, true);
    assert.notEqual(result, null);
    assert.equal(result.state.position[1], 74);
    assert.deepEqual(result.state.velocity, [0, 0, 0]);
});

test("spawnSeed query parsing accepts only fixed safe integers", () => {
    assert.equal(readSpawnDebugSeed(new URLSearchParams("spawnSeed=123")), 123);
    assert.equal(readSpawnDebugSeed(new URLSearchParams("spawnSeed=-45")), -45);
    assert.equal(readSpawnDebugSeed(new URLSearchParams("spawnSeed=1.5")), null);
    assert.equal(readSpawnDebugSeed(new URLSearchParams("spawnSeed=nope")), null);
    assert.equal(readSpawnDebugSeed(new URLSearchParams()), null);
});

function fakeBody() {
    return {
        calls: [],
        respawn(position) {
            this.calls.push([...position]);
            return Object.freeze({
                position,
                velocity: Object.freeze([0, 0, 0]),
                grounded: false,
            });
        },
    };
}
