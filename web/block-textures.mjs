export const BLOCK_TEXTURE_SIZE = 16;
export const BLOCK_TEXTURE_VERSION = "phase-7-original-v1";

export const BlockMaterial = Object.freeze({
    GRASS: "grass",
    ROCK: "rock",
});

export const BLOCK_TEXTURE_METADATA = Object.freeze({
    ownership: "Original from-scratch procedural approximations created for this repository",
    source: "web/block-textures.mjs",
    historicalReference: "Cave Game Tech Test and RubyDung screenshots",
    resolution: `${BLOCK_TEXTURE_SIZE}x${BLOCK_TEXTURE_SIZE}`,
    version: BLOCK_TEXTURE_VERSION,
    copiedAssets: false,
});

const GRASS_PALETTE = Object.freeze([
    Object.freeze([50, 117, 24]),
    Object.freeze([60, 135, 27]),
    Object.freeze([70, 151, 31]),
    Object.freeze([81, 166, 35]),
    Object.freeze([92, 181, 41]),
    Object.freeze([106, 195, 49]),
    Object.freeze([124, 207, 61]),
    Object.freeze([145, 218, 78]),
]);

const ROCK_PALETTE = Object.freeze([
    Object.freeze([13, 13, 13]),
    Object.freeze([29, 29, 29]),
    Object.freeze([69, 69, 69]),
    Object.freeze([91, 91, 91]),
    Object.freeze([117, 117, 117]),
    Object.freeze([146, 146, 146]),
    Object.freeze([178, 178, 178]),
    Object.freeze([208, 208, 208]),
    Object.freeze([229, 229, 229]),
]);

const ROCK_CENTERS = Object.freeze([
    Object.freeze([0.4, 1.1]),
    Object.freeze([5.1, 0.5]),
    Object.freeze([10.8, 1.8]),
    Object.freeze([15.0, 0.2]),
    Object.freeze([2.7, 5.4]),
    Object.freeze([8.0, 5.2]),
    Object.freeze([13.4, 5.7]),
    Object.freeze([0.8, 10.1]),
    Object.freeze([5.7, 10.0]),
    Object.freeze([11.3, 10.3]),
    Object.freeze([15.2, 10.4]),
    Object.freeze([3.0, 14.6]),
    Object.freeze([8.4, 14.1]),
    Object.freeze([13.5, 14.9]),
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
    const fine = hash2d(x, y, 0x1d35a7b9);
    const local = hash2d(Math.floor(x / 2), Math.floor(y / 2), 0x74ac93e1);
    let index = 3
        + positiveModulo(fine >>> 3, 5) - 2
        + positiveModulo(local >>> 8, 3) - 1;

    if ((x * 5 + y * 3 + (fine & 7)) % 19 === 0) index += 2;
    if ((x * 2 + y * 7 + ((fine >>> 5) & 7)) % 23 === 0) index -= 2;
    return GRASS_PALETTE[clamp(index, 0, GRASS_PALETTE.length - 1)];
}

function rockColor(x, y) {
    const nearest = nearestRockCenter(x, y);
    const neighboringLabels = [
        nearestRockCenter(positiveModulo(x + 1, BLOCK_TEXTURE_SIZE), y).label,
        nearestRockCenter(positiveModulo(x - 1, BLOCK_TEXTURE_SIZE), y).label,
        nearestRockCenter(x, positiveModulo(y + 1, BLOCK_TEXTURE_SIZE)).label,
        nearestRockCenter(x, positiveModulo(y - 1, BLOCK_TEXTURE_SIZE)).label,
    ];
    const differentNeighbors = neighboringLabels.filter(label => label !== nearest.label).length;
    const seam = nearest.secondDistance - nearest.firstDistance < 2.5 || differentNeighbors >= 3;

    if (seam) {
        return ROCK_PALETTE[hash2d(x, y, 0x2f31c48d) % 4 === 0 ? 1 : 0];
    }

    const [centerX, centerY] = ROCK_CENTERS[nearest.label];
    const deltaX = wrappedDelta(x, centerX);
    const deltaY = wrappedDelta(y, centerY);
    const base = 4 + hash2d(nearest.label, 0, 0x68d2a5f1) % 4;
    const directionalShade = deltaX + deltaY < -1.5 ? 1 : deltaX + deltaY > 2.5 ? -1 : 0;
    const grain = positiveModulo(hash2d(x, y, 0x9bc457e3), 3) - 1;
    const index = clamp(base + directionalShade + grain, 2, ROCK_PALETTE.length - 1);
    return ROCK_PALETTE[index];
}

function nearestRockCenter(x, y) {
    let label = -1;
    let firstDistance = Number.POSITIVE_INFINITY;
    let secondDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < ROCK_CENTERS.length; index += 1) {
        const [centerX, centerY] = ROCK_CENTERS[index];
        const deltaX = wrappedDelta(x, centerX);
        const deltaY = wrappedDelta(y, centerY);
        const distance = deltaX * deltaX + deltaY * deltaY * 0.9;
        if (distance < firstDistance) {
            secondDistance = firstDistance;
            firstDistance = distance;
            label = index;
        } else if (distance < secondDistance) {
            secondDistance = distance;
        }
    }

    return { label, firstDistance, secondDistance };
}

function wrappedDelta(value, center) {
    const direct = value - center;
    if (direct > BLOCK_TEXTURE_SIZE / 2) return direct - BLOCK_TEXTURE_SIZE;
    if (direct < -BLOCK_TEXTURE_SIZE / 2) return direct + BLOCK_TEXTURE_SIZE;
    return direct;
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

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
