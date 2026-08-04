import test from "node:test";
import assert from "node:assert/strict";
import {
    ATLAS_GUTTER,
    ATLAS_HEIGHT,
    ATLAS_TILE_SIZE,
    ATLAS_TILES,
    ATLAS_WIDTH,
    createAtlasPixels,
    getTilePixelBounds,
    getTileUv,
} from "../atlas.mjs";
import {
    BLOCK_TEXTURE_METADATA,
    BLOCK_TEXTURE_SIZE,
    BlockMaterial,
    generateBlockTexture,
    textureChecksum,
} from "../block-textures.mjs";
import { BlockType } from "../block-type.mjs";
import { Chunk } from "../chunk.mjs";
import { CHUNK_VERTEX_FLOATS } from "../chunk-mesh.mjs";
import { ChunkMesher } from "../chunk-mesher.mjs";
import { ChunkPosition } from "../chunk-position.mjs";
import {
    PIXEL_TEXTURE_SAMPLING,
    configurePixelTextureSampling,
} from "../pixel-texture-sampling.mjs";
import { World } from "../world.mjs";
import { encodeRgbaPng } from "../../tools/generate-block-textures.mjs";

const EXPECTED_CHECKSUMS = Object.freeze({
    [BlockMaterial.GRASS]: 0x4949def5,
    [BlockMaterial.ROCK]: 0xb7403f85,
});

test("original 16 x 16 textures are deterministic and opaque", () => {
    assert.equal(BLOCK_TEXTURE_SIZE, 16);
    assert.equal(BLOCK_TEXTURE_METADATA.copiedAssets, false);

    for (const material of Object.values(BlockMaterial)) {
        const first = generateBlockTexture(material);
        const second = generateBlockTexture(material);
        assert.deepEqual(first, second);
        assert.equal(first.length, 16 * 16 * 4);
        assert.equal(textureChecksum(first), EXPECTED_CHECKSUMS[material]);
        for (let offset = 3; offset < first.length; offset += 4) assert.equal(first[offset], 255);
    }
});

test("grass is mottled green and rock is dark irregular gray", () => {
    const grass = generateBlockTexture(BlockMaterial.GRASS);
    const rock = generateBlockTexture(BlockMaterial.ROCK);
    const grassAverage = averageRgb(grass);
    const rockAverage = averageRgb(rock);

    assert.ok(grassAverage.green > grassAverage.red * 1.8);
    assert.ok(grassAverage.green > grassAverage.blue * 2.2);
    assert.ok(Math.max(rockAverage.red, rockAverage.green, rockAverage.blue)
        - Math.min(rockAverage.red, rockAverage.green, rockAverage.blue) < 10);
    assert.ok((rockAverage.red + rockAverage.green + rockAverage.blue) / 3 < 85);
    assert.ok(countDistinctRgb(grass) >= 6);
    assert.ok(countDistinctRgb(rock) >= 6);

    let differentChannels = 0;
    for (let index = 0; index < grass.length; index += 1) {
        if (grass[index] !== rock[index]) differentChannels += 1;
    }
    assert.ok(differentChannels > 700);
});

test("atlas gutters replicate tile-edge pixels and prevent neighbor bleeding", () => {
    assert.equal(ATLAS_GUTTER, 1);
    const atlas = createAtlasPixels();
    const materials = [
        [ATLAS_TILES.grass, BlockMaterial.GRASS],
        [ATLAS_TILES.rock, BlockMaterial.ROCK],
    ];

    for (const [tile, material] of materials) {
        const texture = generateBlockTexture(material);
        const bounds = getTilePixelBounds(tile);
        for (let relativeY = -ATLAS_GUTTER; relativeY < ATLAS_TILE_SIZE + ATLAS_GUTTER; relativeY += 1) {
            for (let relativeX = -ATLAS_GUTTER; relativeX < ATLAS_TILE_SIZE + ATLAS_GUTTER; relativeX += 1) {
                const sourceX = clamp(relativeX, 0, ATLAS_TILE_SIZE - 1);
                const sourceY = clamp(relativeY, 0, ATLAS_TILE_SIZE - 1);
                assert.deepEqual(
                    atlasPixel(atlas, bounds.x0 + relativeX, bounds.y0 + relativeY),
                    texturePixel(texture, sourceX, sourceY),
                );
            }
        }

        const uv = getTileUv(tile);
        assert.equal(Math.floor(uv.u0 * ATLAS_WIDTH), bounds.x0);
        assert.equal(Math.floor(uv.v0 * ATLAS_HEIGHT), bounds.y0);
        assert.equal(Math.floor(uv.u1 * ATLAS_WIDTH), bounds.x1 - 1);
        assert.equal(Math.floor(uv.v1 * ATLAS_HEIGHT), bounds.y1 - 1);
    }
});

test("all six faces preserve the same material and UV orientation", () => {
    verifyCubeMaterial(BlockType.GRASS, ATLAS_TILES.grass);
    verifyCubeMaterial(BlockType.ROCK, ATLAS_TILES.rock);
});

test("texture sampling is nearest-neighbor with no mipmap generation", () => {
    const calls = [];
    const gl = {
        TEXTURE_2D: 1,
        TEXTURE_MIN_FILTER: 2,
        TEXTURE_MAG_FILTER: 3,
        TEXTURE_WRAP_S: 4,
        TEXTURE_WRAP_T: 5,
        NEAREST: 6,
        CLAMP_TO_EDGE: 7,
        texParameteri(...values) { calls.push(values); },
        generateMipmap() { throw new Error("Mipmaps must not be generated"); },
    };

    configurePixelTextureSampling(gl);
    assert.deepEqual(calls, [
        [1, 2, 6],
        [1, 3, 6],
        [1, 4, 7],
        [1, 5, 7],
    ]);
    assert.deepEqual(PIXEL_TEXTURE_SAMPLING, {
        minFilter: "NEAREST",
        magFilter: "NEAREST",
        wrapS: "CLAMP_TO_EDGE",
        wrapT: "CLAMP_TO_EDGE",
        mipmaps: false,
    });
});

test("retained development generator produces deterministic PNG bytes", () => {
    const pixels = generateBlockTexture(BlockMaterial.GRASS);
    const first = encodeRgbaPng(BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE, pixels);
    const second = encodeRgbaPng(BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE, pixels);
    assert.deepEqual(first, second);
    assert.deepEqual([...first.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(first.readUInt32BE(16), BLOCK_TEXTURE_SIZE);
    assert.equal(first.readUInt32BE(20), BLOCK_TEXTURE_SIZE);
});

function verifyCubeMaterial(blockType, tile) {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(0, 0));
    chunk.setBlock(2, 2, 2, blockType);
    world.addChunk(chunk);
    const mesh = new ChunkMesher().build(chunk, world);
    assert.equal(mesh.faceCount, 6);

    const uv = getTileUv(tile);
    const expected = [uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1];
    for (let face = 0; face < 6; face += 1) {
        const actual = [];
        for (let vertex = 0; vertex < 4; vertex += 1) {
            const offset = (face * 4 + vertex) * CHUNK_VERTEX_FLOATS;
            actual.push(mesh.vertices[offset + 3], mesh.vertices[offset + 4]);
        }
        assertFloatArraysEqual(actual, expected);
    }
}

function averageRgb(pixels) {
    const totals = [0, 0, 0];
    for (let offset = 0; offset < pixels.length; offset += 4) {
        totals[0] += pixels[offset];
        totals[1] += pixels[offset + 1];
        totals[2] += pixels[offset + 2];
    }
    const count = pixels.length / 4;
    return { red: totals[0] / count, green: totals[1] / count, blue: totals[2] / count };
}

function countDistinctRgb(pixels) {
    const values = new Set();
    for (let offset = 0; offset < pixels.length; offset += 4) {
        values.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
    }
    return values.size;
}

function atlasPixel(pixels, x, y) {
    const offset = (y * ATLAS_WIDTH + x) * 4;
    return [...pixels.subarray(offset, offset + 4)];
}

function texturePixel(pixels, x, y) {
    const offset = (y * BLOCK_TEXTURE_SIZE + x) * 4;
    return [...pixels.subarray(offset, offset + 4)];
}

function assertFloatArraysEqual(actual, expected) {
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < actual.length; index += 1) {
        assert.ok(Math.abs(actual[index] - expected[index]) < 1e-6,
            `value ${index}: expected ${expected[index]}, received ${actual[index]}`);
    }
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
