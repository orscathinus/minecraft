import { BlockType, isValidBlockType } from "./block-type.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { CHUNK_DEPTH, CHUNK_WIDTH, WORLD_HEIGHT, requireLocal } from "./world-coordinates.mjs";

export const CHUNK_BLOCK_COUNT = CHUNK_WIDTH * WORLD_HEIGHT * CHUNK_DEPTH;

export class Chunk {
    #blocks;

    constructor(position = new ChunkPosition(0, 0), blocks = null) {
        if (!(position instanceof ChunkPosition)) throw new TypeError("Chunk requires a ChunkPosition");
        this.position = position;

        if (blocks === null) {
            this.#blocks = new Uint8Array(CHUNK_BLOCK_COUNT);
        } else {
            if (!(blocks instanceof Uint8Array) || blocks.length !== CHUNK_BLOCK_COUNT) {
                throw new TypeError(`Chunk blocks must be a Uint8Array of length ${CHUNK_BLOCK_COUNT}`);
            }
            this.#blocks = blocks.slice();
            for (const value of this.#blocks) {
                if (!isValidBlockType(value)) throw new RangeError(`Invalid block type in chunk data: ${value}`);
            }
        }
    }

    static indexOf(x, y, z) {
        requireLocal(x, "x", CHUNK_WIDTH);
        requireLocal(y, "y", WORLD_HEIGHT);
        requireLocal(z, "z", CHUNK_DEPTH);
        return x + CHUNK_WIDTH * (z + CHUNK_DEPTH * y);
    }

    static contains(x, y, z) {
        return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
            && x >= 0 && x < CHUNK_WIDTH
            && y >= 0 && y < WORLD_HEIGHT
            && z >= 0 && z < CHUNK_DEPTH;
    }

    getBlock(x, y, z) {
        return Chunk.contains(x, y, z) ? this.#blocks[Chunk.indexOf(x, y, z)] : BlockType.AIR;
    }

    setBlock(x, y, z, blockType) {
        if (!isValidBlockType(blockType)) throw new RangeError(`Invalid block type: ${blockType}`);
        this.#blocks[Chunk.indexOf(x, y, z)] = blockType;
    }

    fill(blockType) {
        if (!isValidBlockType(blockType)) throw new RangeError(`Invalid block type: ${blockType}`);
        this.#blocks.fill(blockType);
    }

    copyBlocks() { return this.#blocks.slice(); }
}
