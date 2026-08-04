import { BlockType } from "./block-type.mjs";
import { Chunk } from "./chunk.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { WorldConfig } from "./world-config.mjs";
import { World } from "./world.mjs";

export class SeededTerrainGenerator {
    constructor(seed = WorldConfig.defaultSeed) {
        if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
        this.seed = seed | 0;
    }

    terrainHeight(x, z) {
        if (!Number.isInteger(x) || !Number.isInteger(z)
            || x < 0 || x >= WorldConfig.sizeX
            || z < 0 || z >= WorldConfig.sizeZ) {
            throw new RangeError("terrain coordinates are outside the finite world");
        }
        const broad = valueNoise(x, z, 64, this.seed ^ 0x51f15e);
        const detail = valueNoise(x, z, 28, this.seed ^ 0x9e3779b9);
        return clamp(
            Math.round(60 + 2.0 * broad + 1.1 * detail),
            WorldConfig.surfaceMinY,
            WorldConfig.surfaceMaxY,
        );
    }

    generateWorldSync(onProgress = null) {
        const world = new World();
        let completed = 0;
        for (let chunkZ = 0; chunkZ < WorldConfig.chunksZ; chunkZ += 1) {
            for (let chunkX = 0; chunkX < WorldConfig.chunksX; chunkX += 1) {
                world.addChunk(this.#generateChunk(chunkX, chunkZ));
                completed += 1;
                onProgress?.(completed, WorldConfig.chunkCount);
            }
        }
        return world;
    }

    async generateWorld({ onProgress = null, yieldEvery = 8 } = {}) {
        const world = new World();
        let completed = 0;
        for (let chunkZ = 0; chunkZ < WorldConfig.chunksZ; chunkZ += 1) {
            for (let chunkX = 0; chunkX < WorldConfig.chunksX; chunkX += 1) {
                world.addChunk(this.#generateChunk(chunkX, chunkZ));
                completed += 1;
                onProgress?.(completed, WorldConfig.chunkCount);
                if (completed % yieldEvery === 0) await yieldToBrowser();
            }
        }
        return world;
    }

    #generateChunk(chunkX, chunkZ) {
        const chunk = new Chunk(new ChunkPosition(chunkX, chunkZ));
        const baseX = chunkX * WorldConfig.chunkWidth;
        const baseZ = chunkZ * WorldConfig.chunkDepth;
        for (let localZ = 0; localZ < WorldConfig.chunkDepth; localZ += 1) {
            for (let localX = 0; localX < WorldConfig.chunkWidth; localX += 1) {
                const height = this.terrainHeight(baseX + localX, baseZ + localZ);
                for (let y = WorldConfig.minY; y <= height; y += 1) {
                    chunk.setBlock(localX, y, localZ, BlockType.ROCK);
                }
                chunk.setBlock(localX, height, localZ, BlockType.GRASS);
            }
        }
        return chunk;
    }
}

function valueNoise(x, z, scale, seed) {
    const gridX = x / scale;
    const gridZ = z / scale;
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const tx = smooth(gridX - x0);
    const tz = smooth(gridZ - z0);
    const a = hashValue(x0, z0, seed);
    const b = hashValue(x0 + 1, z0, seed);
    const c = hashValue(x0, z0 + 1, seed);
    const d = hashValue(x0 + 1, z0 + 1, seed);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function hashValue(x, z, seed) {
    let value = Math.imul(x ^ seed, 0x27d4eb2d) ^ Math.imul(z + seed, 0x165667b1);
    value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
    value ^= value >>> 13;
    return ((value >>> 0) / 0xffffffff) * 2 - 1;
}

function smooth(value) { return value * value * (3 - 2 * value); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
