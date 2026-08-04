import test from "node:test";
import assert from "node:assert/strict";
import { BlockType } from "../block-type.mjs";
import { Chunk } from "../chunk.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { World } from "../world.mjs";
import {
    chunkCoordinate,
    globalCoordinate,
    globalToChunkPosition,
    globalToLocalPosition,
    localCoordinate,
} from "../world-coordinates.mjs";

test("global and local coordinates convert across positive and negative chunk boundaries", () => {
    const cases = [
        [-17,-2,15],[-16,-1,0],[-1,-1,15],[0,0,0],
        [15,0,15],[16,1,0],[31,1,15],[32,2,0],
    ];
    for (const [global, chunk, local] of cases) {
        assert.equal(chunkCoordinate(global), chunk);
        assert.equal(localCoordinate(global), local);
        assert.equal(globalCoordinate(chunk, local), global);
    }
    assert.deepEqual(globalToChunkPosition(-1, 16), new ChunkPosition(-1, 1));
    assert.deepEqual(globalToLocalPosition(-1, 16), { x: 15, z: 0 });
});

test("world lookup is safe at missing chunks and fixed-height boundaries", () => {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(-1, 0));
    chunk.setBlock(15, 2, 0, BlockType.ROCK);
    world.addChunk(chunk);

    assert.equal(world.getBlock(-1, 2, 0), BlockType.ROCK);
    assert.equal(world.getBlock(0, 2, 0), BlockType.AIR);
    assert.equal(world.getBlock(-1, -1, 0), BlockType.AIR);
    assert.equal(world.getBlock(-1, 64, 0), BlockType.AIR);
    assert.equal(world.setBlock(0, 2, 0, BlockType.GRASS), false);
});
