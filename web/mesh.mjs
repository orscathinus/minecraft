import { getTileUv } from "./atlas.mjs";

export const VERTEX_FLOATS = 6;
export const CUBE_FACE_NORMALS = Object.freeze([
    Object.freeze([0, 0, 1]), Object.freeze([0, 0, -1]),
    Object.freeze([1, 0, 0]), Object.freeze([-1, 0, 0]),
    Object.freeze([0, 1, 0]), Object.freeze([0, -1, 0]),
]);

const FACES = Object.freeze([
    face([[0,0,1],[1,0,1],[1,1,1],[0,1,1]], 0.88),
    face([[1,0,0],[0,0,0],[0,1,0],[1,1,0]], 0.82),
    face([[1,0,1],[1,0,0],[1,1,0],[1,1,1]], 0.76),
    face([[0,0,0],[0,0,1],[0,1,1],[0,1,0]], 0.70),
    face([[0,1,1],[1,1,1],[1,1,0],[0,1,0]], 1.0),
    face([[0,0,0],[1,0,0],[1,0,1],[0,0,1]], 0.55),
]);
const FACE_INDICES = Object.freeze([0, 1, 2, 0, 2, 3]);

export function createVoxelMesh(blocks) {
    if (!Array.isArray(blocks)) throw new TypeError("blocks must be an array");
    const vertices = [];
    const indices = [];
    for (const block of blocks) appendCube(vertices, indices, block);
    const vertexCount = vertices.length / VERTEX_FLOATS;
    return Object.freeze({
        vertices: new Float32Array(vertices),
        indices: vertexCount <= 0xffff ? new Uint16Array(indices) : new Uint32Array(indices),
        vertexCount,
        indexCount: indices.length,
        strideFloats: VERTEX_FLOATS,
    });
}

function appendCube(vertices, indices, block) {
    const x = finite(block?.x, "block.x");
    const y = finite(block?.y, "block.y");
    const z = finite(block?.z, "block.z");
    const uv = getTileUv(block?.tileIndex);
    const corners = [[uv.u0,uv.v0],[uv.u1,uv.v0],[uv.u1,uv.v1],[uv.u0,uv.v1]];
    for (const definition of FACES) {
        const first = vertices.length / VERTEX_FLOATS;
        for (let i = 0; i < 4; i += 1) {
            const [lx,ly,lz] = definition.corners[i];
            const [u,v] = corners[i];
            vertices.push(x+lx, y+ly, z+lz, u, v, definition.brightness);
        }
        for (const relative of FACE_INDICES) indices.push(first + relative);
    }
}

function face(corners, brightness) {
    return Object.freeze({ corners: Object.freeze(corners.map(Object.freeze)), brightness });
}
function finite(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
    return value;
}
