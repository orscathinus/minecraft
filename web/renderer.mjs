import { ATLAS_HEIGHT, ATLAS_WIDTH, createAtlasPixels } from "./atlas.mjs";
import { CHUNK_VERTEX_FLOATS } from "./chunk-mesh.mjs";
import { configurePixelTextureSampling } from "./pixel-texture-sampling.mjs";
import { WorldConfig } from "./world-config.mjs";

const ERROR_NAMES = new Map([
    [0x0500, "INVALID_ENUM"],
    [0x0501, "INVALID_VALUE"],
    [0x0502, "INVALID_OPERATION"],
    [0x0505, "OUT_OF_MEMORY"],
    [0x0506, "INVALID_FRAMEBUFFER_OPERATION"],
    [0x9242, "CONTEXT_LOST_WEBGL"],
]);

export class VoxelRenderer {
    #gl;
    #program;
    #meshes = new Map();
    #texture;
    #projection;
    #view;
    #atlas;
    #drawCalls = 0;
    #frustumCulledChunks = 0;
    #renderedTriangles = 0;
    #totalUploads = 0;
    #totalUploadMs = 0;
    #faceCount = 0;
    #brightFaceCount = 0;
    #darkFaceCount = 0;
    #triangleCount = 0;
    #meshBytes = 0;
    #peakMeshBytes = 0;
    #clipMatrix = new Float32Array(16);
    #frustumPlanes = new Float32Array(24);

    static async create(gl) {
        const [vertexSource, fragmentSource] = await Promise.all([
            loadText(new URL("./shaders/block.vert.glsl", import.meta.url)),
            loadText(new URL("./shaders/block.frag.glsl", import.meta.url)),
        ]);
        return new VoxelRenderer(gl, vertexSource, fragmentSource);
    }

    constructor(gl, vertexSource, fragmentSource) {
        if (!(gl instanceof WebGL2RenderingContext)) throw new TypeError("VoxelRenderer requires WebGL 2");
        this.#gl = gl;
        this.#program = createProgram(gl, vertexSource, fragmentSource);
        this.#texture = createAtlasTexture(gl);
        this.#projection = uniform(gl, this.#program, "uProjection");
        this.#view = uniform(gl, this.#program, "uView");
        this.#atlas = uniform(gl, this.#program, "uAtlas");
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
        assertNoGlErrors(gl, "renderer initialization");
    }

    uploadChunkMesh(position, meshData, { reason = "initial" } = {}) {
        const key = chunkKey(position);
        const previous = this.#meshes.get(key);
        const started = performanceNow();
        const next = new GpuMesh(this.#gl, position, meshData, { reason });
        const uploadMs = performanceNow() - started;

        if (previous) {
            this.#subtractMesh(previous);
            previous.dispose();
        }
        this.#meshes.set(key, next);
        this.#addMesh(next);
        this.#totalUploads += 1;
        this.#totalUploadMs += uploadMs;
        assertNoGlErrors(this.#gl, `chunk mesh upload ${key}`);
        return previous !== undefined;
    }

    removeChunkMesh(position) {
        const key = chunkKey(position);
        const mesh = this.#meshes.get(key);
        if (!mesh) return false;
        this.#subtractMesh(mesh);
        mesh.dispose();
        this.#meshes.delete(key);
        return true;
    }

    clearChunkMeshes() {
        for (const mesh of this.#meshes.values()) mesh.dispose();
        this.#meshes.clear();
        this.#faceCount = 0;
        this.#brightFaceCount = 0;
        this.#darkFaceCount = 0;
        this.#triangleCount = 0;
        this.#meshBytes = 0;
        this.#drawCalls = 0;
        this.#frustumCulledChunks = 0;
        this.#renderedTriangles = 0;
    }

    setMesh(meshData) {
        this.clearChunkMeshes();
        this.uploadChunkMesh({ key: () => "aggregate" }, meshData, { reason: "aggregate" });
    }

    render(projectionMatrix, viewMatrix) {
        const gl = this.#gl;
        updateFrustumPlanes(projectionMatrix, viewMatrix, this.#clipMatrix, this.#frustumPlanes);
        gl.useProgram(this.#program);
        gl.uniformMatrix4fv(this.#projection, false, projectionMatrix);
        gl.uniformMatrix4fv(this.#view, false, viewMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);
        gl.uniform1i(this.#atlas, 0);

        let drawCalls = 0;
        let culled = 0;
        let renderedTriangles = 0;
        for (const mesh of this.#meshes.values()) {
            if (!aabbIntersectsFrustum(mesh, this.#frustumPlanes)) {
                culled += 1;
                continue;
            }
            if (mesh.draw()) {
                drawCalls += 1;
                renderedTriangles += mesh.triangleCount;
            }
        }
        gl.bindVertexArray(null);
        this.#drawCalls = drawCalls;
        this.#frustumCulledChunks = culled;
        this.#renderedTriangles = renderedTriangles;
    }

    writeStats(target) {
        if (!target || typeof target !== "object") throw new TypeError("renderer stats target must be an object");
        target.visibleChunks = this.#meshes.size;
        target.drawCalls = this.#drawCalls;
        target.frustumCulledChunks = this.#frustumCulledChunks;
        target.faceCount = this.#faceCount;
        target.brightFaceCount = this.#brightFaceCount;
        target.darkFaceCount = this.#darkFaceCount;
        target.triangleCount = this.#triangleCount;
        target.renderedTriangles = this.#renderedTriangles;
        target.meshBytes = this.#meshBytes;
        target.peakMeshBytes = this.#peakMeshBytes;
        target.totalUploads = this.#totalUploads;
        target.totalUploadMs = this.#totalUploadMs;
        target.averageUploadMs = this.#totalUploads === 0 ? 0 : this.#totalUploadMs / this.#totalUploads;
        target.liveGpuMeshes = this.#meshes.size;
        target.liveGpuBuffers = this.#meshes.size * 2;
        target.liveVertexArrays = this.#meshes.size;
        return target;
    }

    stats() {
        return Object.freeze(this.writeStats({}));
    }

    get drawCalls() { return this.#drawCalls; }
    get visibleChunkCount() { return this.#meshes.size; }

    dispose() {
        const gl = this.#gl;
        this.clearChunkMeshes();
        if (this.#texture) {
            gl.deleteTexture(this.#texture);
            this.#texture = null;
        }
        if (this.#program) {
            gl.deleteProgram(this.#program);
            this.#program = null;
        }
    }

    #addMesh(mesh) {
        this.#faceCount += mesh.faceCount;
        this.#brightFaceCount += mesh.brightFaceCount;
        this.#darkFaceCount += mesh.darkFaceCount;
        this.#triangleCount += mesh.triangleCount;
        this.#meshBytes += mesh.byteLength;
        this.#peakMeshBytes = Math.max(this.#peakMeshBytes, this.#meshBytes);
    }

    #subtractMesh(mesh) {
        this.#faceCount -= mesh.faceCount;
        this.#brightFaceCount -= mesh.brightFaceCount;
        this.#darkFaceCount -= mesh.darkFaceCount;
        this.#triangleCount -= mesh.triangleCount;
        this.#meshBytes -= mesh.byteLength;
    }
}

class GpuMesh {
    #gl;
    #vao = null;
    #vbo = null;
    #ebo = null;
    #count;
    #type;
    #faceCount;
    #brightFaceCount;
    #darkFaceCount;
    #reason;
    #triangleCount;
    #byteLength;
    minX;
    minY;
    minZ;
    maxX;
    maxY;
    maxZ;

    constructor(gl, position, data, { reason }) {
        validateMesh(data);
        this.#gl = gl;
        this.#count = data.indices.length;
        this.#type = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.#faceCount = data.faceCount ?? Math.floor(data.indices.length / 6);
        this.#brightFaceCount = data.brightFaceCount ?? 0;
        this.#darkFaceCount = data.darkFaceCount ?? Math.max(0, this.#faceCount - this.#brightFaceCount);
        this.#reason = reason;
        this.#triangleCount = Math.floor(data.indices.length / 3);
        this.#byteLength = data.vertices.byteLength + data.indices.byteLength;
        setChunkBounds(this, position);

        try {
            this.#vao = required(gl.createVertexArray(), "vertex array");
            this.#vbo = required(gl.createBuffer(), "vertex buffer");
            this.#ebo = required(gl.createBuffer(), "index buffer");

            gl.bindVertexArray(this.#vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ebo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

            const stride = CHUNK_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
            gl.enableVertexAttribArray(2);
            gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
            gl.bindVertexArray(null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } catch (failure) {
            this.dispose();
            throw failure;
        }
    }

    draw() {
        if (this.#count === 0 || !this.#vao) return false;
        const gl = this.#gl;
        gl.bindVertexArray(this.#vao);
        gl.drawElements(gl.TRIANGLES, this.#count, this.#type, 0);
        return true;
    }

    get faceCount() { return this.#faceCount; }
    get brightFaceCount() { return this.#brightFaceCount; }
    get darkFaceCount() { return this.#darkFaceCount; }
    get reason() { return this.#reason; }
    get triangleCount() { return this.#triangleCount; }
    get byteLength() { return this.#byteLength; }

    dispose() {
        const gl = this.#gl;
        if (this.#ebo) gl.deleteBuffer(this.#ebo);
        if (this.#vbo) gl.deleteBuffer(this.#vbo);
        if (this.#vao) gl.deleteVertexArray(this.#vao);
        this.#ebo = null;
        this.#vbo = null;
        this.#vao = null;
    }
}

export function updateFrustumPlanes(projection, view, clip, planes) {
    if (!(projection instanceof Float32Array) || projection.length !== 16
        || !(view instanceof Float32Array) || view.length !== 16
        || !(clip instanceof Float32Array) || clip.length !== 16
        || !(planes instanceof Float32Array) || planes.length !== 24) {
        throw new TypeError("frustum matrices and plane storage have invalid dimensions");
    }
    multiplyMatrix4(clip, projection, view);
    writePlane(planes, 0, clip[3] + clip[0], clip[7] + clip[4], clip[11] + clip[8], clip[15] + clip[12]);
    writePlane(planes, 4, clip[3] - clip[0], clip[7] - clip[4], clip[11] - clip[8], clip[15] - clip[12]);
    writePlane(planes, 8, clip[3] + clip[1], clip[7] + clip[5], clip[11] + clip[9], clip[15] + clip[13]);
    writePlane(planes, 12, clip[3] - clip[1], clip[7] - clip[5], clip[11] - clip[9], clip[15] - clip[13]);
    writePlane(planes, 16, clip[3] + clip[2], clip[7] + clip[6], clip[11] + clip[10], clip[15] + clip[14]);
    writePlane(planes, 20, clip[3] - clip[2], clip[7] - clip[6], clip[11] - clip[10], clip[15] - clip[14]);
    return planes;
}

export function aabbIntersectsFrustum(bounds, planes) {
    for (let offset = 0; offset < 24; offset += 4) {
        const a = planes[offset];
        const b = planes[offset + 1];
        const c = planes[offset + 2];
        const d = planes[offset + 3];
        const x = a >= 0 ? bounds.maxX : bounds.minX;
        const y = b >= 0 ? bounds.maxY : bounds.minY;
        const z = c >= 0 ? bounds.maxZ : bounds.minZ;
        if (a * x + b * y + c * z + d < 0) return false;
    }
    return true;
}

function multiplyMatrix4(out, a, b) {
    for (let column = 0; column < 4; column += 1) {
        const b0 = b[column * 4];
        const b1 = b[column * 4 + 1];
        const b2 = b[column * 4 + 2];
        const b3 = b[column * 4 + 3];
        out[column * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[column * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[column * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[column * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
}

function writePlane(planes, offset, a, b, c, d) {
    const length = Math.hypot(a, b, c);
    const inverse = length > 0 ? 1 / length : 1;
    planes[offset] = a * inverse;
    planes[offset + 1] = b * inverse;
    planes[offset + 2] = c * inverse;
    planes[offset + 3] = d * inverse;
}

function setChunkBounds(target, position) {
    if (Number.isInteger(position?.x) && Number.isInteger(position?.z)) {
        target.minX = position.x * WorldConfig.chunkWidth;
        target.maxX = target.minX + WorldConfig.chunkWidth;
        target.minZ = position.z * WorldConfig.chunkDepth;
        target.maxZ = target.minZ + WorldConfig.chunkDepth;
    } else {
        target.minX = WorldConfig.minX;
        target.maxX = WorldConfig.maxX + 1;
        target.minZ = WorldConfig.minZ;
        target.maxZ = WorldConfig.maxZ + 1;
    }
    target.minY = WorldConfig.minY;
    target.maxY = WorldConfig.maxY + 1;
}

function createAtlasTexture(gl) {
    const texture = required(gl.createTexture(), "texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATLAS_WIDTH, ATLAS_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, createAtlasPixels());
    configurePixelTextureSampling(gl);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compile(gl, gl.VERTEX_SHADER, vertexSource, "vertex");
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, "fragment");
    const program = required(gl.createProgram(), "shader program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const linked = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
    const log = gl.getProgramInfoLog(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!linked) {
        gl.deleteProgram(program);
        throw new Error(`Shader link failed: ${log || "unknown error"}`);
    }
    return program;
}

function compile(gl, type, source, label) {
    const shader = required(gl.createShader(type), `${label} shader`);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || "unknown error";
        gl.deleteShader(shader);
        throw new Error(`${label} shader compilation failed: ${log}`);
    }
    return shader;
}

function uniform(gl, program, name) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`Required shader uniform is missing: ${name}`);
    return location;
}

function required(value, label) {
    if (!value) throw new Error(`Unable to create ${label}`);
    return value;
}

function validateMesh(data) {
    if (!(data?.vertices instanceof Float32Array)) throw new TypeError("meshData.vertices must be Float32Array");
    if (!(data?.indices instanceof Uint16Array) && !(data?.indices instanceof Uint32Array)) {
        throw new TypeError("meshData.indices must be Uint16Array or Uint32Array");
    }
    if (data.vertices.length % CHUNK_VERTEX_FLOATS !== 0) throw new RangeError("Mesh vertex data has an invalid stride");
}

function chunkKey(position) {
    if (!position || typeof position.key !== "function") throw new TypeError("chunk position must provide key()");
    return position.key();
}

function performanceNow() {
    return globalThis.performance?.now?.() ?? Date.now();
}

async function loadText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load shader resource ${url.pathname}: HTTP ${response.status}`);
    return response.text();
}

export function assertNoGlErrors(gl, label) {
    const errors = [];
    for (let error = gl.getError(); error !== gl.NO_ERROR; error = gl.getError()) {
        errors.push(ERROR_NAMES.get(error) ?? `0x${error.toString(16)}`);
    }
    if (errors.length) throw new Error(`WebGL error during ${label}: ${errors.join(", ")}`);
}
