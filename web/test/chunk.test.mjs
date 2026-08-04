import test from "node:test";
import assert from "node:assert/strict";
import { BlockType } from "../block-type.mjs";
import { CHUNK_BLOCK_COUNT, Chunk } from "../chunk.mjs";
import { ChunkPosition } from "../chunk-position.mjs";

test("chunk uses exactly one byte per 16 x 64 x 16 block", () => {
    const chunk = new Chunk(new ChunkPosition(0, 0));
    assert.equal(CHUNK_BLOCK_COUNT, 16384);
    assert.equal(chunk.copyBlocks().byteLength, 16384);
});

test("chunk index formula is unique and x varies fastest", () => {
    assert.equal(Chunk.indexOf(0, 0, 0), 0);
    assert.equal(Chunk.indexOf(1, 0, 0), 1);
    assert.equal(Chunk.indexOf(0, 0, 1), 16);
    assert.equal(Chunk.indexOf(0, 1, 0), 256);
    assert.equal(Chunk.indexOf(15, 63, 15), CHUNK_BLOCK_COUNT - 1);

    const seen = new Set();
    for (let y = 0; y < 64; y += 1) {
        for (let z = 0; z < 16; z += 1) {
            for (let x = 0; x < 16; x += 1) seen.add(Chunk.indexOf(x, y, z));
        }
    }
    assert.equal(seen.size, CHUNK_BLOCK_COUNT);
});

test("bounds-safe lookup returns AIR and valid writes round-trip", () => {
    const chunk = new Chunk(new ChunkPosition(-2, 3));
    chunk.setBlock(4, 5, 6, BlockType.GRASS);
    assert.equal(chunk.getBlock(4, 5, 6), BlockType.GRASS);
    assert.equal(chunk.getBlock(-1, 5, 6), BlockType.AIR);
    assert.equal(chunk.getBlock(4, 64, 6), BlockType.AIR);
    assert.throws(() => chunk.setBlock(16, 0, 0, BlockType.ROCK), RangeError);
});
