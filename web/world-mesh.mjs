import { ChunkMesher } from "./chunk-mesher.mjs";
import { CHUNK_VERTEX_FLOATS } from "./chunk-mesh.mjs";

export async function buildFiniteWorldMesh(world, { onProgress = null, yieldEvery = 8 } = {}) {
    const mesher = new ChunkMesher();
    const chunks = world.chunks();
    const meshes = [];
    for (let index = 0; index < chunks.length; index += 1) {
        meshes.push(mesher.build(chunks[index], world));
        onProgress?.(index + 1, chunks.length);
        if ((index + 1) % yieldEvery === 0) await yieldToBrowser();
    }
    return combineChunkMeshes(meshes);
}

export function combineChunkMeshes(meshes) {
    if (!Array.isArray(meshes)) throw new TypeError("meshes must be an array");
    let vertexFloatCount = 0;
    let indexCount = 0;
    let faceCount = 0;
    let vertexCount = 0;
    for (const mesh of meshes) {
        vertexFloatCount += mesh.vertices.length;
        indexCount += mesh.indices.length;
        faceCount += mesh.faceCount;
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
        vertexCount,
        indexCount,
        strideFloats: CHUNK_VERTEX_FLOATS,
        chunkCount: meshes.length,
    });
}

function yieldToBrowser() {
    return new Promise(resolve => {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
        else setTimeout(resolve, 0);
    });
}
