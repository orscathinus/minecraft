import test from "node:test";
import assert from "node:assert/strict";
import { BlockType } from "../block-type.mjs";
import { Chunk } from "../chunk.mjs";
import { ChunkMesher } from "../chunk-mesher.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { createDeterministicTestWorld } from "../test-chunk.mjs";
import { World } from "../world.mjs";

function meshFor(blocks) {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(0, 0));
    for (const [x, y, z, type] of blocks) chunk.setBlock(x, y, z, type);
    world.addChunk(chunk);
    return new ChunkMesher().build(chunk, world);
}

test("one isolated block produces six faces", () => {
    const mesh = meshFor([[1,1,1,BlockType.ROCK]]);
    assert.equal(mesh.faceCount, 6);
    assert.equal(mesh.vertexCount, 24);
    assert.equal(mesh.indexCount, 36);
});

test("two adjacent blocks remove their shared internal faces", () => {
    assert.equal(meshFor([
        [1,1,1,BlockType.ROCK],
        [2,1,1,BlockType.GRASS],
    ]).faceCount, 10);
});

test("a 2 x 2 x 2 solid arrangement has twenty-four exterior faces", () => {
    const blocks = [];
    for (let y = 1; y <= 2; y += 1) {
        for (let z = 1; z <= 2; z += 1) {
            for (let x = 1; x <= 2; x += 1) blocks.push([x,y,z,BlockType.ROCK]);
        }
    }
    assert.equal(meshFor(blocks).faceCount, 24);
});

test("loaded neighboring chunk hides the shared boundary face", () => {
    const world = new World();
    const left = new Chunk(new ChunkPosition(0, 0));
    const right = new Chunk(new ChunkPosition(1, 0));
    left.setBlock(15, 2, 3, BlockType.ROCK);
    right.setBlock(0, 2, 3, BlockType.ROCK);
    world.addChunk(left);
    world.addChunk(right);

    assert.equal(new ChunkMesher().build(left, world).faceCount, 5);
    assert.equal(new ChunkMesher().build(right, world).faceCount, 5);
});

test("missing neighboring chunk is treated as visible outside data", () => {
    assert.equal(meshFor([[15,2,3,BlockType.ROCK]]).faceCount, 6);
});

test("AIR creates no geometry", () => {
    assert.equal(meshFor([[1,1,1,BlockType.AIR]]).faceCount, 0);
});

test("deterministic Phase 3 test chunk has stable optimized face count", () => {
    const { world, chunk } = createDeterministicTestWorld();
    assert.equal(new ChunkMesher().build(chunk, world).faceCount, 1220);
});
