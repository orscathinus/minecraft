import { BlockType } from "./block-type.mjs";
import { Chunk } from "./chunk.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { globalToChunkPosition, globalToLocalPosition, isWorldY } from "./world-coordinates.mjs";

export class World {
    #chunks = new Map();

    addChunk(chunk) {
        if (!(chunk instanceof Chunk)) throw new TypeError("World.addChunk requires a Chunk");
        this.#chunks.set(chunk.position.key(), chunk);
        return chunk;
    }

    getChunk(positionOrX, z = undefined) {
        const position = positionOrX instanceof ChunkPosition
            ? positionOrX
            : new ChunkPosition(positionOrX, z);
        return this.#chunks.get(position.key()) ?? null;
    }

    hasChunk(positionOrX, z = undefined) {
        return this.getChunk(positionOrX, z) !== null;
    }

    getBlock(globalX, y, globalZ) {
        if (!Number.isInteger(globalX) || !Number.isInteger(globalZ) || !isWorldY(y)) {
            return BlockType.AIR;
        }
        const chunk = this.getChunk(globalToChunkPosition(globalX, globalZ));
        if (!chunk) return BlockType.AIR;
        const local = globalToLocalPosition(globalX, globalZ);
        return chunk.getBlock(local.x, y, local.z);
    }

    setBlock(globalX, y, globalZ, blockType) {
        if (!Number.isInteger(globalX) || !Number.isInteger(globalZ) || !isWorldY(y)) return false;
        const chunk = this.getChunk(globalToChunkPosition(globalX, globalZ));
        if (!chunk) return false;
        const local = globalToLocalPosition(globalX, globalZ);
        chunk.setBlock(local.x, y, local.z, blockType);
        return true;
    }

    chunks() { return Object.freeze([...this.#chunks.values()]); }
}
