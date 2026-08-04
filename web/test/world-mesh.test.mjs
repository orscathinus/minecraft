import test from "node:test";
import assert from "node:assert/strict";
import { ChunkMesher } from "../chunk-mesher.mjs";
import { SeededTerrainGenerator } from "../terrain-generator.mjs";
import { combineChunkMeshes } from "../world-mesh.mjs";

test("all 256 chunk meshes combine into one indexed world mesh", () => {
    const world = new SeededTerrainGenerator(1337).generateWorldSync();
    const mesher = new ChunkMesher();
    const chunkMeshes = world.chunks().map(chunk => mesher.build(chunk, world));
    const mesh = combineChunkMeshes(chunkMeshes);

    assert.equal(mesh.chunkCount, 256);
    assert.ok(mesh.faceCount > 65_536);
    assert.equal(mesh.indices.length, mesh.faceCount * 6);
    assert.equal(mesh.vertices.length, mesh.faceCount * 4 * 6);
    assert.ok(mesh.indices instanceof Uint32Array);
});
