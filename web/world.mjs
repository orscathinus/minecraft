import { BlockType } from "./block-type.mjs";
import { Chunk } from "./chunk.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { globalToChunkPosition, globalToLocalPosition } from "./world-coordinates.mjs";
import { isFiniteChunkCoordinate, isFiniteWorldCoordinate } from "./world-config.mjs";

export class World {
    #chunks = new Map();

    addChunk(chunk) {
        if (!(chunk instanceof Chunk)) throw new TypeError("World.addChunk requires a Chunk");
        if (!isFiniteChunkCoordinate(chunk.position.x, chunk.position.z)) {
            throw new RangeError("Chunk position is outside the finite world");
        }
        this.#chunks.set(chunk.position.key(), chunk);
        return chunk;
    }

    getChunk(positionOrX, z = undefined) {
        const position = positionOrX instanceof ChunkPosition
            ? positionOrX
            : new ChunkPosition(positionOrX, z);
        if (!isFiniteChunkCoordinate(position.x, position.z)) return null;
        return this.#chunks.get(position.key()) ?? null;
    }

    hasChunk(positionOrX, z = undefined) {
        return this.getChunk(positionOrX, z) !== null;
    }

    getBlock(globalX, y, globalZ) {
        if (!isFiniteWorldCoordinate(globalX, y, globalZ)) return BlockType.AIR;
        const chunk = this.getChunk(globalToChunkPosition(globalX, globalZ));
        if (!chunk) return BlockType.AIR;
        const local = globalToLocalPosition(globalX, globalZ);
        return chunk.getBlock(local.x, y, local.z);
    }

    setBlock(globalX, y, globalZ, blockType) {
        if (!isFiniteWorldCoordinate(globalX, y, globalZ)) return false;
        const chunk = this.getChunk(globalToChunkPosition(globalX, globalZ));
        if (!chunk) return false;
        const local = globalToLocalPosition(globalX, globalZ);
        chunk.setBlock(local.x, y, local.z, blockType);
        return true;
    }

    chunks() { return Object.freeze([...this.#chunks.values()]); }
    get chunkCount() { return this.#chunks.size; }
}
