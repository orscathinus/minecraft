import { ChunkMesher } from "./chunk-mesher.mjs";
import { CHUNK_VERTEX_FLOATS } from "./chunk-mesh.mjs";

export async function buildFiniteWorldMesh(
    world,
    { sunlight = null, onProgress = null, yieldEvery = 8 } = {},
) {
    sunlight?.rebuildDirtyColumns();
    const mesher = new ChunkMesher();
    const chunks = world.chunks();
    const meshes = [];
    for (let index = 0; index < chunks.length; index += 1) {
        meshes.push(mesher.build(chunks[index], world, sunlight));
        onProgress?.(index + 1, chunks.length);
        if ((index + 1) % yieldEvery === 0) await yieldToBrowser();
    }
    return combineChunkMeshes(meshes);
}

export function rebuildDirtyChunkMeshes(world, sunlight) {
    if (!sunlight || typeof sunlight.rebuildDirtyColumns !== "function") {
        throw new TypeError("rebuilding dirty chunk meshes requires a SunlightModel");
    }
    const rebuiltColumns = sunlight.rebuildDirtyColumns();
    const positions = world.consumeDirtyChunkPositions();
    const mesher = new ChunkMesher();
    const meshes = [];
    for (const position of positions) {
        const chunk = world.getChunk(position);
        if (chunk) meshes.push(mesher.build(chunk, world, sunlight));
    }
    return Object.freeze({ rebuiltColumns, positions, meshes: Object.freeze(meshes) });
}

export function combineChunkMeshes(meshes) {
    if (!Array.isArray(meshes)) throw new TypeError("meshes must be an array");
    let vertexFloatCount = 0;
    let indexCount = 0;
    let faceCount = 0;
    let brightFaceCount = 0;
    let darkFaceCount = 0;
    let vertexCount = 0;
    for (const mesh of meshes) {
        vertexFloatCount += mesh.vertices.length;
        indexCount += mesh.indices.length;
        faceCount += mesh.faceCount;
        brightFaceCount += mesh.brightFaceCount;
        darkFaceCount += mesh.darkFaceCount;
        vertexCount += mesh.vertexCount;
    }

    const vertices = new Float32Array(vertexFloatCount);
    const indices = new Uint32Array(indexCount);
    let vertexFloatOffset = 0;
    let indexOffset = 0;
    let baseVertex = 0;
    for (const mesh of meshes) {
        vertices.set(mesh.vertices, vertexFloatOffset);
        for (let index = 0; index < mesh.indices.length; index += 1) {
            indices[indexOffset + index] = mesh.indices[index] + baseVertex;
        }
        vertexFloatOffset += mesh.vertices.length;
        indexOffset += mesh.indices.length;
        baseVertex += mesh.vertexCount;
    }

    return Object.freeze({
        vertices,
        indices,
        faceCount,
        brightFaceCount,
        darkFaceCount,
        vertexCount,
        indexCount,
        strideFloats: CHUNK_VERTEX_FLOATS,
        chunkCount: meshes.length,
    });
}

function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
