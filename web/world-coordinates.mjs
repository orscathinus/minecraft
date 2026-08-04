import { ChunkPosition } from "./chunk-position.mjs";

export const CHUNK_WIDTH = 16;
export const CHUNK_DEPTH = 16;
export const WORLD_HEIGHT = 64;

export function chunkCoordinate(globalCoordinate) {
    requireInteger(globalCoordinate, "globalCoordinate");
    return Math.floor(globalCoordinate / CHUNK_WIDTH);
}

export function localCoordinate(globalCoordinate) {
    requireInteger(globalCoordinate, "globalCoordinate");
    return ((globalCoordinate % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
}

export function globalCoordinate(chunkCoordinateValue, localCoordinateValue) {
    requireInteger(chunkCoordinateValue, "chunkCoordinate");
    requireLocal(localCoordinateValue, "localCoordinate", CHUNK_WIDTH);
    return chunkCoordinateValue * CHUNK_WIDTH + localCoordinateValue;
}

export function globalToChunkPosition(globalX, globalZ) {
    return new ChunkPosition(chunkCoordinate(globalX), chunkCoordinate(globalZ));
}

export function globalToLocalPosition(globalX, globalZ) {
    return Object.freeze({ x: localCoordinate(globalX), z: localCoordinate(globalZ) });
}

export function isWorldY(y) {
    return Number.isInteger(y) && y >= 0 && y < WORLD_HEIGHT;
}

export function requireLocal(value, name, size) {
    if (!Number.isInteger(value) || value < 0 || value >= size) {
        throw new RangeError(`${name} must be an integer in [0, ${size})`);
    }
}

function requireInteger(value, name) {
    if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
}
