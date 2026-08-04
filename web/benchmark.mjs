import { BlockType } from "./block-type.mjs";
import { CaveGenerator } from "./cave-generator.mjs";
import { ChunkMesher } from "./chunk-mesher.mjs";
import { performanceNow } from "./performance-diagnostics.mjs";
import { SunlightModel } from "./sunlight.mjs";
import { SeededTerrainGenerator } from "./terrain-generator.mjs";
import { WorldConfig } from "./world-config.mjs";

export async function runTechTestBenchmark({ seed = WorldConfig.defaultSeed, now = performanceNow } = {}) {
    if (!Number.isSafeInteger(seed)) throw new TypeError("benchmark seed must be a safe integer");
    if (typeof now !== "function") throw new TypeError("benchmark clock must be a function");

    const totalStart = now();
    const terrainStart = now();
    const generator = new SeededTerrainGenerator(seed);
    const world = await generator.generateWorld();
    const terrainGenerationMs = now() - terrainStart;

    const caveStart = now();
    const caveResult = await new CaveGenerator(seed).carveWorld(world);
    const caveGenerationMs = now() - caveStart;

    const sunlightStart = now();
    const sunlight = new SunlightModel(world);
    await sunlight.rebuildAll();
    const sunlightGenerationMs = now() - sunlightStart;
    const totalWorldGenerationMs = now() - totalStart;

    world.clearDirtyChunks();
    world.clearDirtyLightingColumns?.();

    const mesher = new ChunkMesher();
    let totalChunkMeshMs = 0;
    let maximumChunkMeshMs = 0;
    let totalVisibleFaces = 0;
    let totalTriangles = 0;
    let meshBytes = 0;
    let opaqueBlocks = 0;
    let pending = WorldConfig.chunkCount;
    let peakPendingChunks = pending;

    for (const chunk of world.chunks()) {
        const meshStart = now();
        const mesh = mesher.build(chunk, world, sunlight);
        const meshDuration = now() - meshStart;
        totalChunkMeshMs += meshDuration;
        maximumChunkMeshMs = Math.max(maximumChunkMeshMs, meshDuration);
        totalVisibleFaces += mesh.faceCount;
        totalTriangles += mesh.indexCount / 3;
        meshBytes += mesh.vertices.byteLength + mesh.indices.byteLength;
        pending -= 1;
        peakPendingChunks = Math.max(peakPendingChunks, pending);

        for (let y = 0; y < WorldConfig.height; y += 1) {
            for (let z = 0; z < WorldConfig.chunkDepth; z += 1) {
                for (let x = 0; x < WorldConfig.chunkWidth; x += 1) {
                    if (chunk.getBlock(x, y, z) !== BlockType.AIR) opaqueBlocks += 1;
                }
            }
        }
    }

    const blockArrayBytes = WorldConfig.chunkCount
        * WorldConfig.chunkWidth
        * WorldConfig.height
        * WorldConfig.chunkDepth;

    return Object.freeze({
        benchmark: "cave-game-tech-test-phase-11",
        seed,
        terrainGenerationMs,
        caveGenerationMs,
        sunlightGenerationMs,
        totalWorldGenerationMs,
        totalChunkMeshMs,
        averageChunkMeshMs: totalChunkMeshMs / WorldConfig.chunkCount,
        maximumChunkMeshMs,
        totalVisibleFaces,
        totalTriangles,
        opaqueBlocks,
        naiveUnculledFaces: opaqueBlocks * 6,
        hiddenFacesOmitted: totalVisibleFaces < opaqueBlocks * 6,
        blockArrayBytes,
        sunlightBytes: WorldConfig.sizeX * WorldConfig.sizeZ,
        chunkMeshBytes: meshBytes,
        peakPendingChunks,
        chunks: WorldConfig.chunkCount,
        caveCarvedBlocks: caveResult.carvedBlocks,
        caveMinimumY: caveResult.minimumCarvedY,
    });
}
