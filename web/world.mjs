import { BlockType } from "./block-type.mjs";
import { Chunk } from "./chunk.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { globalToChunkPosition, globalToLocalPosition } from "./world-coordinates.mjs";
import { isFiniteChunkCoordinate, isFiniteWorldCoordinate } from "./world-config.mjs";

export class World {
    #chunks = new Map();
    #dirtyChunks = new Map();

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
        if (chunk.getBlock(local.x, y, local.z) === blockType) return false;
        chunk.setBlock(local.x, y, local.z, blockType);
        this.#markBlockAndBoundaryNeighborsDirty(globalX, globalZ);
        return true;
    }

    markChunkDirty(positionOrX, z = undefined) {
        const position = positionOrX instanceof ChunkPosition
            ? positionOrX
            : new ChunkPosition(positionOrX, z);
        if (!isFiniteChunkCoordinate(position.x, position.z) || !this.hasChunk(position)) return false;
        this.#dirtyChunks.set(position.key(), position);
        return true;
    }

    dirtyChunkPositions() {
        return Object.freeze([...this.#dirtyChunks.values()]);
    }

    consumeDirtyChunkPositions() {
        const positions = this.dirtyChunkPositions();
        this.#dirtyChunks.clear();
        return positions;
    }

    clearDirtyChunks() {
        this.#dirtyChunks.clear();
    }

    #markBlockAndBoundaryNeighborsDirty(globalX, globalZ) {
        const position = globalToChunkPosition(globalX, globalZ);
        const local = globalToLocalPosition(globalX, globalZ);
        this.markChunkDirty(position);
        if (local.x === 0) this.markChunkDirty(position.x - 1, position.z);
        if (local.x === 15) this.markChunkDirty(position.x + 1, position.z);
        if (local.z === 0) this.markChunkDirty(position.x, position.z - 1);
        if (local.z === 15) this.markChunkDirty(position.x, position.z + 1);
    }

    chunks() { return Object.freeze([...this.#chunks.values()]); }
    get chunkCount() { return this.#chunks.size; }
}
