import { ATLAS_TILES, getTileUv } from "./atlas.mjs";
import { BlockType, isOpaqueBlock } from "./block-type.mjs";
import { ChunkMesh, CHUNK_VERTEX_FLOATS } from "./chunk-mesh.mjs";
import { CHUNK_DEPTH, CHUNK_WIDTH, globalCoordinate, WORLD_HEIGHT } from "./world-coordinates.mjs";

const FACE_INDICES = Object.freeze([0, 1, 2, 0, 2, 3]);
const FACES = Object.freeze([
    face([0, 0, 1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], 0.88),
    face([0, 0,-1], [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], 0.82),
    face([1, 0, 0], [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], 0.76),
    face([-1,0, 0], [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], 0.70),
    face([0, 1, 0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], 1.00),
    face([0,-1, 0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], 0.55),
]);

export class ChunkMesher {
    build(chunk, world) {
        const vertices = [];
        const indices = [];
        let faceCount = 0;
        const baseX = globalCoordinate(chunk.position.x, 0);
        const baseZ = globalCoordinate(chunk.position.z, 0);

        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
            for (let z = 0; z < CHUNK_DEPTH; z += 1) {
                for (let x = 0; x < CHUNK_WIDTH; x += 1) {
                    const blockType = chunk.getBlock(x, y, z);
                    if (!isOpaqueBlock(blockType)) continue;

                    const globalX = baseX + x;
                    const globalZ = baseZ + z;
                    for (const definition of FACES) {
                        const [dx, dy, dz] = definition.normal;
                        if (isOpaqueBlock(world.getBlock(globalX + dx, y + dy, globalZ + dz))) continue;
                        appendFace(vertices, indices, globalX, y, globalZ, blockType, definition);
                        faceCount += 1;
                    }
                }
            }
        }

        const vertexCount = vertices.length / CHUNK_VERTEX_FLOATS;
        return new ChunkMesh(
            chunk.position,
            new Float32Array(vertices),
            vertexCount <= 0xffff ? new Uint16Array(indices) : new Uint32Array(indices),
            faceCount,
        );
    }
}

function appendFace(vertices, indices, x, y, z, blockType, definition) {
    const uv = getTileUv(blockType === BlockType.GRASS ? ATLAS_TILES.grass : ATLAS_TILES.rock);
    const textureCorners = [[uv.u0,uv.v0],[uv.u1,uv.v0],[uv.u1,uv.v1],[uv.u0,uv.v1]];
    const firstVertex = vertices.length / CHUNK_VERTEX_FLOATS;

    for (let index = 0; index < 4; index += 1) {
        const [localX, localY, localZ] = definition.corners[index];
        const [u, v] = textureCorners[index];
        vertices.push(x + localX, y + localY, z + localZ, u, v, definition.brightness);
    }
    for (const relativeIndex of FACE_INDICES) indices.push(firstVertex + relativeIndex);
}

function face(normal, corners, brightness) {
    return Object.freeze({
        normal: Object.freeze(normal),
        corners: Object.freeze(corners.map(corner => Object.freeze(corner))),
        brightness,
    });
}
