import {
    BLOCK_TEXTURE_SIZE,
    BlockMaterial,
    generateBlockTexture,
} from "./block-textures.mjs";

export const ATLAS_TILE_SIZE = BLOCK_TEXTURE_SIZE;
export const ATLAS_GUTTER = 1;
export const ATLAS_TILE_STRIDE = ATLAS_TILE_SIZE + ATLAS_GUTTER * 2;
export const ATLAS_COLUMNS = 2;
export const ATLAS_ROWS = 1;
export const ATLAS_WIDTH = ATLAS_TILE_STRIDE * ATLAS_COLUMNS;
export const ATLAS_HEIGHT = ATLAS_TILE_STRIDE * ATLAS_ROWS;

export const ATLAS_TILES = Object.freeze({ grass: 0, rock: 1 });

const UV_EDGE_EPSILON_TEXELS = 1 / 1024;

export function getTilePixelBounds(tileIndex) {
    validateTileIndex(tileIndex);
    const tileX = tileIndex % ATLAS_COLUMNS;
    const tileY = Math.floor(tileIndex / ATLAS_COLUMNS);
    const x0 = tileX * ATLAS_TILE_STRIDE + ATLAS_GUTTER;
    const y0 = tileY * ATLAS_TILE_STRIDE + ATLAS_GUTTER;
    return Object.freeze({
        x0,
        y0,
        x1: x0 + ATLAS_TILE_SIZE,
        y1: y0 + ATLAS_TILE_SIZE,
    });
}

export function getTileUv(tileIndex) {
    const bounds = getTilePixelBounds(tileIndex);
    return Object.freeze({
        u0: (bounds.x0 + UV_EDGE_EPSILON_TEXELS) / ATLAS_WIDTH,
        v0: (bounds.y0 + UV_EDGE_EPSILON_TEXELS) / ATLAS_HEIGHT,
        u1: (bounds.x1 - UV_EDGE_EPSILON_TEXELS) / ATLAS_WIDTH,
        v1: (bounds.y1 - UV_EDGE_EPSILON_TEXELS) / ATLAS_HEIGHT,
    });
}

export function createAtlasPixels() {
    const pixels = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
    copyTileWithReplicatedGutter(
        pixels,
        ATLAS_TILES.grass,
        generateBlockTexture(BlockMaterial.GRASS),
    );
    copyTileWithReplicatedGutter(
        pixels,
        ATLAS_TILES.rock,
        generateBlockTexture(BlockMaterial.ROCK),
    );
    return pixels;
}

function copyTileWithReplicatedGutter(atlas, tileIndex, source) {
    const bounds = getTilePixelBounds(tileIndex);
    for (let relativeY = -ATLAS_GUTTER; relativeY < ATLAS_TILE_SIZE + ATLAS_GUTTER; relativeY += 1) {
        for (let relativeX = -ATLAS_GUTTER; relativeX < ATLAS_TILE_SIZE + ATLAS_GUTTER; relativeX += 1) {
            const sourceX = clamp(relativeX, 0, ATLAS_TILE_SIZE - 1);
            const sourceY = clamp(relativeY, 0, ATLAS_TILE_SIZE - 1);
            const destinationX = bounds.x0 + relativeX;
            const destinationY = bounds.y0 + relativeY;
            const sourceOffset = (sourceY * ATLAS_TILE_SIZE + sourceX) * 4;
            const destinationOffset = (destinationY * ATLAS_WIDTH + destinationX) * 4;
            atlas[destinationOffset] = source[sourceOffset];
            atlas[destinationOffset + 1] = source[sourceOffset + 1];
            atlas[destinationOffset + 2] = source[sourceOffset + 2];
            atlas[destinationOffset + 3] = source[sourceOffset + 3];
        }
    }
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function validateTileIndex(tileIndex) {
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= ATLAS_COLUMNS * ATLAS_ROWS) {
        throw new RangeError(`Invalid atlas tile index: ${tileIndex}`);
    }
}
