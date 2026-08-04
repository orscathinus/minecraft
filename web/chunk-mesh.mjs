export const CHUNK_VERTEX_FLOATS = 6;

export class ChunkMesh {
    constructor(position, vertices, indices, faceCount) {
        if (!(vertices instanceof Float32Array)) throw new TypeError("vertices must be Float32Array");
        if (!(indices instanceof Uint16Array) && !(indices instanceof Uint32Array)) {
            throw new TypeError("indices must be Uint16Array or Uint32Array");
        }
        if (!Number.isInteger(faceCount) || faceCount < 0) {
            throw new RangeError("faceCount must be non-negative");
        }

        this.position = position;
        this.vertices = vertices;
        this.indices = indices;
        this.faceCount = faceCount;
        this.vertexCount = vertices.length / CHUNK_VERTEX_FLOATS;
        this.indexCount = indices.length;
        this.strideFloats = CHUNK_VERTEX_FLOATS;
        Object.freeze(this);
    }
}
