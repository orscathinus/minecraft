import test from "node:test";
import assert from "node:assert/strict";
import { Chunk } from "../chunk.mjs";
import { ChunkManager } from "../chunk-manager.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { World } from "../world.mjs";
import { WorldConfig } from "../world-config.mjs";

test("normal frame budgets eventually process every finite-world chunk exactly once", () => {
    const world = new World();
    for (let z = 0; z < WorldConfig.chunksZ; z += 1) {
        for (let x = 0; x < WorldConfig.chunksX; x += 1) {
            world.addChunk(new Chunk(new ChunkPosition(x, z)));
        }
    }
    world.clearDirtyChunks();

    const uploaded = [];
    const renderer = {
        uploadChunkMesh(position, mesh, { reason }) {
            uploaded.push(`${position.key()}:${reason}`);
        },
    };
    const sunlight = { rebuildDirtyColumns() { return Object.freeze([]); } };
    const mesher = {
        build() {
            return Object.freeze({
                vertices: new Float32Array(),
                indices: new Uint16Array(),
                faceCount: 0,
                brightFaceCount: 0,
                darkFaceCount: 0,
            });
        },
    };
    const manager = new ChunkManager(world, sunlight, renderer, {
        playerPosition: [128, 60, 128],
        mesher,
    });

    let frames = 0;
    while (!manager.snapshot().complete && frames < 200) {
        manager.processFrame();
        frames += 1;
    }

    const state = manager.snapshot();
    assert.equal(frames, 128);
    assert.equal(state.complete, true);
    assert.equal(state.queued, 0);
    assert.equal(state.meshed, WorldConfig.chunkCount);
    assert.equal(state.visible, WorldConfig.chunkCount);
    assert.equal(state.totalUploads, WorldConfig.chunkCount);
    assert.equal(state.unnecessaryDuplicateUploads, 0);
    assert.equal(new Set(uploaded).size, WorldConfig.chunkCount);
    assert.ok(uploaded.every(value => value.endsWith(":initial")));
});
