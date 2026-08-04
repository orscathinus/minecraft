import test from "node:test";
import assert from "node:assert/strict";
import { BlockType, isValidBlockType } from "../block-type.mjs";
import { CaveGenerator, carveSphere } from "../cave-generator.mjs";
import { ChunkMesher } from "../chunk-mesher.mjs";
import { SeededTerrainGenerator } from "../terrain-generator.mjs";
import { WorldConfig } from "../world-config.mjs";
import { World } from "../world.mjs";

function createCarvedWorld(terrainSeed = 1337, caveSeed = terrainSeed) {
    const world = new SeededTerrainGenerator(terrainSeed).generateWorldSync();
    const result = new CaveGenerator(caveSeed).carveWorldSync(world);
    return { world, result };
}

function fingerprint(world) {
    let hash = 2166136261 >>> 0;
    for (const chunk of world.chunks()) {
        for (const block of chunk.copyBlocks()) {
            hash ^= block;
            hash = Math.imul(hash, 16777619);
        }
    }
    return hash >>> 0;
}

test("cave generation is deterministic and cave seeds alter the carving", () => {
    const first = createCarvedWorld(1337, 9001);
    const second = createCarvedWorld(1337, 9001);
    const different = createCarvedWorld(1337, 9002);

    assert.equal(fingerprint(first.world), fingerprint(second.world));
    assert.deepEqual(
        {
            carvedBlocks: first.result.carvedBlocks,
            minimumCarvedY: first.result.minimumCarvedY,
            surfaceOpenings: first.result.surfaceOpenings,
            affectedChunks: first.result.affectedChunks.map(position => position.key()),
        },
        {
            carvedBlocks: second.result.carvedBlocks,
            minimumCarvedY: second.result.minimumCarvedY,
            surfaceOpenings: second.result.surfaceOpenings,
            affectedChunks: second.result.affectedChunks.map(position => position.key()),
        },
    );
    assert.notEqual(fingerprint(first.world), fingerprint(different.world));
});

test("default caves open at the surface, reach Y=1, and preserve the solid bottom", () => {
    const { world, result } = createCarvedWorld();
    assert.equal(result.minimumCarvedY, 1);
    assert.ok(result.surfaceOpenings > 0);
    assert.ok(result.carvedBlocks > 0);

    for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
        for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
            assert.notEqual(world.getBlock(x, 0, z), BlockType.AIR);
        }
    }
});

test("carved worlds contain only valid blocks and grass requires upper direct sunlight", () => {
    const { world } = createCarvedWorld(42);
    for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
        for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
            let topSolidY = -1;
            for (let y = WorldConfig.maxY; y >= WorldConfig.minY; y -= 1) {
                const block = world.getBlock(x, y, z);
                assert.equal(isValidBlockType(block), true);
                if (topSolidY < 0 && block !== BlockType.AIR) topSolidY = y;
                if (block === BlockType.GRASS) {
                    assert.equal(y, topSolidY);
                    assert.ok(y >= WorldConfig.surfaceMinY && y <= WorldConfig.surfaceMaxY);
                    for (let above = y + 1; above <= WorldConfig.maxY; above += 1) {
                        assert.equal(world.getBlock(x, above, z), BlockType.AIR);
                    }
                }
            }
            if (topSolidY >= WorldConfig.surfaceMinY) {
                assert.equal(world.getBlock(x, topSolidY, z), BlockType.GRASS);
            }
        }
    }
});

test("a cave crossing a chunk boundary invalidates both sides and meshes the seam once", () => {
    const world = new SeededTerrainGenerator(1337).generateWorldSync();
    world.clearDirtyChunks();
    const changed = carveSphere(world, 15.5, 30.5, 8.5, 1.75);
    assert.ok(changed > 0);

    const dirtyKeys = new Set(world.dirtyChunkPositions().map(position => position.key()));
    assert.equal(dirtyKeys.has("0,0"), true);
    assert.equal(dirtyKeys.has("1,0"), true);

    const left = world.getChunk(0, 0);
    const right = world.getChunk(1, 0);
    const mesher = new ChunkMesher();
    const loadedFaceCount = mesher.build(left, world).faceCount + mesher.build(right, world).faceCount;

    const isolatedLeftWorld = new World();
    isolatedLeftWorld.addChunk(left);
    const isolatedRightWorld = new World();
    isolatedRightWorld.addChunk(right);
    const isolatedFaceCount = mesher.build(left, isolatedLeftWorld).faceCount
        + mesher.build(right, isolatedRightWorld).faceCount;

    assert.ok(loadedFaceCount < isolatedFaceCount);
});
