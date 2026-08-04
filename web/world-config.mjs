export const WorldConfig = Object.freeze({
    minX: 0,
    maxX: 255,
    minY: 0,
    maxY: 63,
    minZ: 0,
    maxZ: 255,
    sizeX: 256,
    height: 64,
    sizeZ: 256,
    chunkWidth: 16,
    chunkDepth: 16,
    chunksX: 16,
    chunksZ: 16,
    chunkCount: 256,
    surfaceMinY: 57,
    surfaceMaxY: 63,
    defaultSeed: 1337,
});

export function isFiniteWorldCoordinate(x, y, z) {
    return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
        && x >= WorldConfig.minX && x <= WorldConfig.maxX
        && y >= WorldConfig.minY && y <= WorldConfig.maxY
        && z >= WorldConfig.minZ && z <= WorldConfig.maxZ;
}

export function isFiniteHorizontalCoordinate(x, z) {
    return Number.isInteger(x) && Number.isInteger(z)
        && x >= WorldConfig.minX && x <= WorldConfig.maxX
        && z >= WorldConfig.minZ && z <= WorldConfig.maxZ;
}

export function isFiniteChunkCoordinate(chunkX, chunkZ) {
    return Number.isInteger(chunkX) && Number.isInteger(chunkZ)
        && chunkX >= 0 && chunkX < WorldConfig.chunksX
        && chunkZ >= 0 && chunkZ < WorldConfig.chunksZ;
}
