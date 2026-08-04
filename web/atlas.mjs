export const ATLAS_TILE_SIZE = 16;
export const ATLAS_COLUMNS = 2;
export const ATLAS_ROWS = 1;
export const ATLAS_WIDTH = ATLAS_TILE_SIZE * ATLAS_COLUMNS;
export const ATLAS_HEIGHT = ATLAS_TILE_SIZE * ATLAS_ROWS;

export const ATLAS_TILES = Object.freeze({ grass: 0, rock: 1 });

export function getTileUv(tileIndex) {
    validateTileIndex(tileIndex);
    const tileX = tileIndex % ATLAS_COLUMNS;
    const tileY = Math.floor(tileIndex / ATLAS_COLUMNS);
    const halfTexelU = 0.5 / ATLAS_WIDTH;
    const halfTexelV = 0.5 / ATLAS_HEIGHT;
    return Object.freeze({
        u0: tileX / ATLAS_COLUMNS + halfTexelU,
        v0: tileY / ATLAS_ROWS + halfTexelV,
        u1: (tileX + 1) / ATLAS_COLUMNS - halfTexelU,
        v1: (tileY + 1) / ATLAS_ROWS - halfTexelV,
    });
}

export function createAtlasPixels() {
    const pixels = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
    paintTile(pixels, ATLAS_TILES.grass, grassPixel);
    paintTile(pixels, ATLAS_TILES.rock, rockPixel);
    return pixels;
}

function paintTile(pixels, tileIndex, pixelGenerator) {
    const tileX = (tileIndex % ATLAS_COLUMNS) * ATLAS_TILE_SIZE;
    const tileY = Math.floor(tileIndex / ATLAS_COLUMNS) * ATLAS_TILE_SIZE;
    for (let y = 0; y < ATLAS_TILE_SIZE; y += 1) {
        for (let x = 0; x < ATLAS_TILE_SIZE; x += 1) {
            const [red, green, blue] = pixelGenerator(x, y);
            const offset = ((tileY + y) * ATLAS_WIDTH + tileX + x) * 4;
            pixels[offset] = red;
            pixels[offset + 1] = green;
            pixels[offset + 2] = blue;
            pixels[offset + 3] = 255;
        }
    }
}

function grassPixel(x, y) {
    const variation = hash2d(x, y, 17) % 29;
    const blade = ((x * 5 + y * 11) % 17 === 0) ? -24 : 0;
    return [clampByte(66 + variation + blade), clampByte(142 + variation * 2 + blade), clampByte(61 + Math.floor(variation / 2) + blade)];
}

function rockPixel(x, y) {
    const variation = hash2d(x, y, 43) % 45;
    const seam = ((x + y * 3) % 19 === 0) ? -28 : 0;
    const value = clampByte(91 + variation + seam);
    return [value, clampByte(value + 2), clampByte(value + 5)];
}

function hash2d(x, y, seed) {
    let value = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 3, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return (value ^ (value >>> 16)) >>> 0;
}

function clampByte(value) { return Math.max(0, Math.min(255, value)); }
function validateTileIndex(tileIndex) {
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= ATLAS_COLUMNS * ATLAS_ROWS) {
        throw new RangeError(`Invalid atlas tile index: ${tileIndex}`);
    }
}
