import test from "node:test";
import assert from "node:assert/strict";
import { Chunk } from "../chunk.mjs";
import {
    ChunkManager,
    ChunkPriorityQueue,
    ChunkProcessingMode,
    chunkFromWorldPosition,
} from "../chunk-manager.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { World } from "../world.mjs";

class FakeRenderer {
    uploads = [];
    uploadChunkMesh(position, mesh, { reason }) {
        this.uploads.push({ key: position.key(), mesh, reason });
    }
}

class FakeMesher {
    builds = [];
    build(chunk) {
        this.builds.push(chunk.position.key());
        return Object.freeze({
            vertices: new Float32Array(),
            indices: new Uint16Array(),
            faceCount: 0,
            brightFaceCount: 0,
            darkFaceCount: 0,
        });
    }
}

class FakeSunlight {
    rebuilds = 0;
    rebuildDirtyColumns() {
        this.rebuilds += 1;
        return Object.freeze([]);
    }
}

const ONE_PER_FRAME = Object.freeze({
    normal: Object.freeze({ maxChunksPerFrame: 1, frameInterval: 1 }),
    historical: Object.freeze({ maxChunksPerFrame: 1, frameInterval: 3 }),
});

test("priority queue uses squared distance with deterministic z then x ties", () => {
    const queue = new ChunkPriorityQueue();
    queue.enqueue(work(2, 1, 1));
    queue.enqueue(work(1, 2, 1));
    queue.enqueue(work(1, 1, 0));
    queue.enqueue(work(4, 4, 8));

    assert.deepEqual([
        queue.dequeue().position.key(),
        queue.dequeue().position.key(),
        queue.dequeue().position.key(),
        queue.dequeue().position.key(),
    ], ["1,1", "2,1", "1,2", "4,4"]);
});

test("closest chunks are meshed and uploaded first", () => {
    const world = worldWithChunks([[0,0],[1,0],[0,1],[1,1]]);
    const renderer = new FakeRenderer();
    const manager = new ChunkManager(world, new FakeSunlight(), renderer, {
        playerPosition: [24, 60, 24],
        modeConfig: ONE_PER_FRAME,
        mesher: new FakeMesher(),
    });

    for (let index = 0; index < 4; index += 1) manager.processFrame();
    assert.deepEqual(renderer.uploads.map(upload => upload.key), [
        "1,1",
        "1,0",
        "0,1",
        "0,0",
    ]);
    assert.equal(manager.snapshot().unnecessaryDuplicateUploads, 0);
});

test("unfinished work is reprioritized after the player changes chunks", () => {
    const world = worldWithChunks([[0,0],[1,0],[2,2],[2,3],[3,2],[3,3]]);
    const renderer = new FakeRenderer();
    const manager = new ChunkManager(world, new FakeSunlight(), renderer, {
        playerPosition: [1, 60, 1],
        modeConfig: ONE_PER_FRAME,
        mesher: new FakeMesher(),
    });

    manager.processFrame();
    assert.equal(renderer.uploads[0].key, "0,0");
    assert.equal(manager.updatePlayerPosition(63, 63), true);
    manager.processFrame();
    assert.equal(renderer.uploads[1].key, "3,3");
    assert.equal(manager.snapshot().playerChunk.key(), "3,3");
});

test("historical mode uses a frame budget without sleeping", () => {
    const world = worldWithChunks([[0,0],[1,0]]);
    const renderer = new FakeRenderer();
    const manager = new ChunkManager(world, new FakeSunlight(), renderer, {
        playerPosition: [1, 60, 1],
        mode: ChunkProcessingMode.HISTORICAL,
        modeConfig: ONE_PER_FRAME,
        mesher: new FakeMesher(),
    });

    assert.equal(manager.processFrame().length, 0);
    assert.equal(manager.processFrame().length, 0);
    assert.equal(manager.processFrame().length, 1);
    assert.equal(renderer.uploads.length, 1);
    assert.equal(manager.snapshot().mode, "historical");
});

test("visible chunks are not uploaded twice unless explicitly refreshed", () => {
    const world = worldWithChunks([[0,0]]);
    const renderer = new FakeRenderer();
    const manager = new ChunkManager(world, new FakeSunlight(), renderer, {
        playerPosition: [1, 60, 1],
        modeConfig: ONE_PER_FRAME,
        mesher: new FakeMesher(),
    });

    manager.processFrame();
    manager.updatePlayerPosition(12, 12);
    manager.processFrame();
    assert.equal(renderer.uploads.length, 1);

    assert.equal(manager.queueRefresh(0, 0), true);
    manager.processFrame();
    assert.equal(renderer.uploads.length, 2);
    assert.deepEqual(renderer.uploads.map(upload => upload.reason), ["initial", "refresh"]);
    assert.equal(manager.snapshot().unnecessaryDuplicateUploads, 0);
});

test("world dirty chunks are relit before their refresh upload", () => {
    const world = worldWithChunks([[0,0]]);
    const order = [];
    const sunlight = {
        rebuildDirtyColumns() { order.push("relight"); return Object.freeze([]); },
    };
    const renderer = {
        uploadChunkMesh(position, mesh, { reason }) { order.push(`upload:${reason}:${position.key()}`); },
    };
    const mesher = {
        build(chunk) { order.push(`mesh:${chunk.position.key()}`); return emptyMesh(); },
    };
    const manager = new ChunkManager(world, sunlight, renderer, {
        playerPosition: [1, 60, 1],
        modeConfig: ONE_PER_FRAME,
        mesher,
    });

    manager.processFrame();
    order.length = 0;
    world.markChunkDirty(0, 0);
    manager.processFrame();
    assert.deepEqual(order, ["relight", "mesh:0,0", "upload:refresh:0,0"]);
});

test("player world positions map to the finite 16 by 16 chunk grid", () => {
    assert.equal(chunkFromWorldPosition(0, 0).key(), "0,0");
    assert.equal(chunkFromWorldPosition(15.999, 15.999).key(), "0,0");
    assert.equal(chunkFromWorldPosition(16, 16).key(), "1,1");
    assert.equal(chunkFromWorldPosition(255.999, 255.999).key(), "15,15");
    assert.equal(chunkFromWorldPosition(-50, 400).key(), "0,15");
});

function worldWithChunks(positions) {
    const world = new World();
    for (const [x, z] of positions) world.addChunk(new Chunk(new ChunkPosition(x, z)));
    world.clearDirtyChunks();
    return world;
}

function work(x, z, distanceSquared) {
    return Object.freeze({
        key: `${x},${z}`,
        position: new ChunkPosition(x, z),
        distanceSquared,
        epoch: 1,
        revision: 0,
    });
}

function emptyMesh() {
    return Object.freeze({
        vertices: new Float32Array(),
        indices: new Uint16Array(),
        faceCount: 0,
        brightFaceCount: 0,
        darkFaceCount: 0,
    });
}
