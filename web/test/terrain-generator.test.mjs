import test from "node:test";
import assert from "node:assert/strict";
import { BlockType, isValidBlockType } from "../block-type.mjs";
import { SeededTerrainGenerator } from "../terrain-generator.mjs";
import { WorldConfig } from "../world-config.mjs";

const generator = new SeededTerrainGenerator(1337);
const world = generator.generateWorldSync();

test("finite world constants and generated chunk count are exact", () => {
    assert.deepEqual(
        {
            x: [WorldConfig.minX, WorldConfig.maxX],
            y: [WorldConfig.minY, WorldConfig.maxY],
            z: [WorldConfig.minZ, WorldConfig.maxZ],
            chunks: [WorldConfig.chunksX, WorldConfig.chunksZ],
        },
        { x: [0, 255], y: [0, 63], z: [0, 255], chunks: [16, 16] },
    );
    assert.equal(world.chunkCount, 256);
});

test("same seed is deterministic and different seeds alter terrain", () => {
    const same = new SeededTerrainGenerator(1337);
    const different = new SeededTerrainGenerator(7331);
    let changed = 0;
    for (let z = 0; z < 256; z += 7) {
        for (let x = 0; x < 256; x += 7) {
            assert.equal(generator.terrainHeight(x, z), same.terrainHeight(x, z));
            if (generator.terrainHeight(x, z) !== different.terrainHeight(x, z)) changed += 1;
        }
    }
    assert.ok(changed > 20);
});

test("columns stay in range with one exposed grass cap and a solid bottom", () => {
    for (let z = 0; z < 256; z += 1) {
        for (let x = 0; x < 256; x += 1) {
            const height = generator.terrainHeight(x, z);
            assert.ok(height >= 57 && height <= 63);
            assert.equal(world.getBlock(x, height, z), BlockType.GRASS);
            if (height < 63) assert.equal(world.getBlock(x, height + 1, z), BlockType.AIR);
            assert.equal(world.getBlock(x, 0, z), BlockType.ROCK);
        }
    }
});

test("only AIR, GRASS, and ROCK occur", () => {
    for (const chunk of world.chunks()) {
        for (const value of chunk.copyBlocks()) assert.equal(isValidBlockType(value), true);
    }
});

test("writes outside the finite world are rejected", () => {
    assert.equal(world.setBlock(-1, 60, 0, BlockType.GRASS), false);
    assert.equal(world.setBlock(256, 60, 0, BlockType.GRASS), false);
    assert.equal(world.setBlock(0, -1, 0, BlockType.ROCK), false);
    assert.equal(world.setBlock(0, 64, 0, BlockType.ROCK), false);
    assert.equal(world.setBlock(0, 60, 256, BlockType.GRASS), false);
});
