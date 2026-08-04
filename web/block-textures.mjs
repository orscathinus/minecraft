export const BLOCK_TEXTURE_SIZE = 16;
export const BLOCK_TEXTURE_VERSION = "phase-7-original-v1";

export const BlockMaterial = Object.freeze({
    GRASS: "grass",
    ROCK: "rock",
});

export const BLOCK_TEXTURE_METADATA = Object.freeze({
    ownership: "Original procedural assets created for this repository",
    source: "web/block-textures.mjs",
    resolution: `${BLOCK_TEXTURE_SIZE}x${BLOCK_TEXTURE_SIZE}`,
    version: BLOCK_TEXTURE_VERSION,
    copiedAssets: false,
});

const GRASS_PALETTE = Object.freeze([
    Object.freeze([38, 91, 34]),
    Object.freeze([47, 108, 39]),
    Object.freeze([55, 124, 44]),
    Object.freeze([64, 139, 50]),
    Object.freeze([74, 153, 58]),
    Object.freeze([88, 166, 69]),
]);

const ROCK_PALETTE = Object.freeze([
    Object.freeze([42, 44, 48]),
    Object.freeze([51, 53, 58]),
    Object.freeze([61, 63, 68]),
    Object.freeze([72, 74, 80]),
    Object.freeze([84, 86, 92]),
    Object.freeze([98, 100, 106]),
]);

export function generateBlockTexture(material) {
    if (material !== BlockMaterial.GRASS && material !== BlockMaterial.ROCK) {
        throw new RangeError(`Unknown block material: ${material}`);
    }

    const pixels = new Uint8Array(BLOCK_TEXTURE_SIZE * BLOCK_TEXTURE_SIZE * 4);
    for (let y = 0; y < BLOCK_TEXTURE_SIZE; y += 1) {
        for (let x = 0; x < BLOCK_TEXTURE_SIZE; x += 1) {
            const color = material === BlockMaterial.GRASS
                ? grassColor(x, y)
                : rockColor(x, y);
            const offset = (y * BLOCK_TEXTURE_SIZE + x) * 4;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = 255;
        }
    }
    return pixels;
}

export function textureChecksum(pixels) {
    if (!(pixels instanceof Uint8Array)) throw new TypeError("pixels must be Uint8Array");
    let hash = 0x811c9dc5;
    for (const value of pixels) {
        hash ^= value;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function grassColor(x, y) {
    const coarse = hash2d(Math.floor(x / 3), Math.floor(y / 3), 0x13579bdf);
    const fine = hash2d(x, y, 0x2468ace0);
    let index = positiveModulo(
        coarse % GRASS_PALETTE.length + fine % 3 - 1,
        GRASS_PALETTE.length,
    );

    if ((fine >>> 8) % 17 === 0) index = Math.max(0, index - 2);
    else if ((fine >>> 16) % 19 === 0) index = Math.min(GRASS_PALETTE.length - 1, index + 1);
    return GRASS_PALETTE[index];
}

function rockColor(x, y) {
    const coarse = hash2d(Math.floor(x / 4), Math.floor(y / 4), 0x5a17c9e3);
    const fine = hash2d(x, y, 0x73b2d145);
    let index = positiveModulo(
        coarse % ROCK_PALETTE.length + fine % 3 - 1,
        ROCK_PALETTE.length,
    );

    if ((x * 3 + y * 5 + (fine & 7)) % 23 === 0) index = 0;
    else if ((x * 7 + y * 2 + ((fine >>> 5) & 7)) % 29 === 0) {
        index = Math.min(ROCK_PALETTE.length - 1, index + 2);
    }
    return ROCK_PALETTE[index];
}

function hash2d(x, y, seed) {
    let value = Math.imul(x ^ seed, 0x27d4eb2d) ^ Math.imul(y + seed, 0x165667b1);
    value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
    value ^= value >>> 13;
    return value >>> 0;
}

function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
}
