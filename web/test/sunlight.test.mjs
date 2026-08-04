import test from "node:test";
import assert from "node:assert/strict";
import { BlockType } from "../block-type.mjs";
import { Chunk } from "../chunk.mjs";
import { ChunkMesher } from "../chunk-mesher.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import { CHUNK_VERTEX_FLOATS } from "../chunk-mesh.mjs";
import { LightState, LightingConfig, SunlightModel } from "../sunlight.mjs";
import { World } from "../world.mjs";
import { rebuildDirtyChunkMeshes } from "../world-mesh.mjs";

function createWorld() {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(0, 0));
    world.addChunk(chunk);
    return { world, chunk };
}

test("unobstructed vertical sunlight travels through AIR to the first opaque block", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(3, 2, 3, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    assert.equal(sunlight.rebuildColumn(3, 3), 2);
    assert.equal(sunlight.airState(3, 63, 3), LightState.BRIGHT);
    assert.equal(sunlight.airState(3, 3, 3), LightState.BRIGHT);
    assert.equal(sunlight.blockState(3, 2, 3), LightState.BRIGHT);
});

test("an opaque rock roof blocks light beneath it", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(4, 10, 4, BlockType.ROCK);
    chunk.setBlock(4, 1, 4, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(4, 4);
    assert.equal(sunlight.blockState(4, 10, 4), LightState.BRIGHT);
    assert.equal(sunlight.airState(4, 9, 4), LightState.DARK);
    assert.equal(sunlight.blockState(4, 1, 4), LightState.DARK);
});

test("AIR at the upper map edge allows light to continue downward", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(5, 20, 5, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(5, 5);
    for (const y of [63, 62, 40, 21]) {
        assert.equal(sunlight.airState(5, y, 5), LightState.BRIGHT);
    }
    assert.equal(sunlight.blockState(5, 20, 5), LightState.BRIGHT);
});

test("an opaque block at Y=63 is the bright first hit", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(6, 63, 6, BlockType.GRASS);
    chunk.setBlock(6, 62, 6, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(6, 6);
    assert.equal(sunlight.topOpaqueY(6, 6), 63);
    assert.equal(sunlight.blockState(6, 63, 6), LightState.BRIGHT);
    assert.equal(sunlight.blockState(6, 62, 6), LightState.DARK);
});

test("cave floors are bright only in vertically open columns", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(7, 3, 7, BlockType.ROCK);
    chunk.setBlock(8, 3, 7, BlockType.ROCK);
    chunk.setBlock(8, 12, 7, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(7, 7);
    sunlight.rebuildColumn(8, 7);
    assert.equal(sunlight.blockState(7, 3, 7), LightState.BRIGHT);
    assert.equal(sunlight.airState(7, 4, 7), LightState.BRIGHT);
    assert.equal(sunlight.blockState(8, 12, 7), LightState.BRIGHT);
    assert.equal(sunlight.airState(8, 11, 7), LightState.DARK);
    assert.equal(sunlight.blockState(8, 3, 7), LightState.DARK);
});

test("chunk geometry contains only binary BRIGHT and DARK values", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(2, 8, 2, BlockType.ROCK);
    chunk.setBlock(2, 2, 2, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(2, 2);
    const mesh = new ChunkMesher().build(chunk, world, sunlight);
    const states = new Set();
    for (let offset = 5; offset < mesh.vertices.length; offset += CHUNK_VERTEX_FLOATS) {
        states.add(mesh.vertices[offset]);
    }
    assert.deepEqual([...states].sort(), [LightState.DARK, LightState.BRIGHT]);
    assert.equal(mesh.brightFaceCount + mesh.darkFaceCount, mesh.faceCount);
    assert.ok(mesh.brightFaceCount > 0);
    assert.ok(mesh.darkFaceCount > 0);
});

test("changed columns relight before their dirty chunk meshes rebuild", () => {
    const { world, chunk } = createWorld();
    chunk.setBlock(9, 4, 9, BlockType.ROCK);
    const sunlight = new SunlightModel(world);
    sunlight.rebuildColumn(9, 9);
    world.clearDirtyChunks();
    world.clearDirtyLightingColumns();

    assert.equal(world.setBlock(9, 12, 9, BlockType.ROCK), true);
    assert.equal(sunlight.blockState(9, 4, 9), LightState.BRIGHT);
    const result = rebuildDirtyChunkMeshes(world, sunlight);
    assert.deepEqual(result.rebuiltColumns, [{ x: 9, z: 9 }]);
    assert.equal(result.positions.length, 1);
    assert.equal(result.meshes.length, 1);
    assert.equal(sunlight.blockState(9, 12, 9), LightState.BRIGHT);
    assert.equal(sunlight.blockState(9, 4, 9), LightState.DARK);
});

test("lighting uses exactly two levels and fixed cave-fog parameters", () => {
    assert.deepEqual(LightState, { DARK: 0, BRIGHT: 1 });
    assert.equal(LightingConfig.brightBrightness, 1);
    assert.equal(LightingConfig.darkBrightness, 0.28);
    assert.ok(LightingConfig.darkFogStart < LightingConfig.darkFogEnd);
    assert.equal(LightingConfig.fogSteps, 5);
});
