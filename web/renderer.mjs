import { ATLAS_HEIGHT, ATLAS_WIDTH, createAtlasPixels } from "./atlas.mjs";
import { CHUNK_VERTEX_FLOATS } from "./chunk-mesh.mjs";
import { configurePixelTextureSampling } from "./pixel-texture-sampling.mjs";

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
    #totalUploads = 0;

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
        const next = new GpuMesh(this.#gl, meshData, { key, reason });
        previous?.dispose();
        this.#meshes.set(key, next);
        this.#totalUploads += 1;
        assertNoGlErrors(this.#gl, `chunk mesh upload ${key}`);
        return previous !== undefined;
    }

    removeChunkMesh(position) {
        const key = chunkKey(position);
        const mesh = this.#meshes.get(key);
        if (!mesh) return false;
        mesh.dispose();
        this.#meshes.delete(key);
        return true;
    }

    clearChunkMeshes() {
        for (const mesh of this.#meshes.values()) mesh.dispose();
        this.#meshes.clear();
    }

    // Retained for small isolated renderer tests and legacy development tools.
    setMesh(meshData) {
        this.clearChunkMeshes();
        this.uploadChunkMesh({ key: () => "aggregate" }, meshData, { reason: "aggregate" });
    }

    render(projectionMatrix, viewMatrix) {
        const gl = this.#gl;
        gl.useProgram(this.#program);
        gl.uniformMatrix4fv(this.#projection, false, projectionMatrix);
        gl.uniformMatrix4fv(this.#view, false, viewMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);
        gl.uniform1i(this.#atlas, 0);
        let drawCalls = 0;
        for (const mesh of this.#meshes.values()) {
            if (mesh.draw()) drawCalls += 1;
        }
        this.#drawCalls = drawCalls;
        assertNoGlErrors(gl, "frame render");
    }

    stats() {
        let faceCount = 0;
        let brightFaceCount = 0;
        let darkFaceCount = 0;
        for (const mesh of this.#meshes.values()) {
            faceCount += mesh.faceCount;
            brightFaceCount += mesh.brightFaceCount;
            darkFaceCount += mesh.darkFaceCount;
        }
        return Object.freeze({
            visibleChunks: this.#meshes.size,
            drawCalls: this.#drawCalls,
            faceCount,
            brightFaceCount,
            darkFaceCount,
            totalUploads: this.#totalUploads,
        });
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
}

class GpuMesh {
    #gl;
    #vao;
    #vbo;
    #ebo;
    #count;
    #type;
    #faceCount;
    #brightFaceCount;
    #darkFaceCount;
    #reason;

    constructor(gl, data, { reason }) {
        validateMesh(data);
        this.#gl = gl;
        this.#count = data.indices.length;
        this.#type = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this.#faceCount = data.faceCount ?? Math.floor(data.indices.length / 6);
        this.#brightFaceCount = data.brightFaceCount ?? 0;
        this.#darkFaceCount = data.darkFaceCount ?? Math.max(0, this.#faceCount - this.#brightFaceCount);
        this.#reason = reason;
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
    }

    draw() {
        if (this.#count === 0) return false;
        const gl = this.#gl;
        gl.bindVertexArray(this.#vao);
        gl.drawElements(gl.TRIANGLES, this.#count, this.#type, 0);
        gl.bindVertexArray(null);
        return true;
    }

    get faceCount() { return this.#faceCount; }
    get brightFaceCount() { return this.#brightFaceCount; }
    get darkFaceCount() { return this.#darkFaceCount; }
    get reason() { return this.#reason; }

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

function createAtlasTexture(gl) {
    const texture = required(gl.createTexture(), "texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        ATLAS_WIDTH,
        ATLAS_HEIGHT,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        createAtlasPixels(),
    );
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
    if (!(data?.vertices instanceof Float32Array)) {
        throw new TypeError("meshData.vertices must be Float32Array");
    }
    if (!(data?.indices instanceof Uint16Array) && !(data?.indices instanceof Uint32Array)) {
        throw new TypeError("meshData.indices must be Uint16Array or Uint32Array");
    }
    if (data.vertices.length % CHUNK_VERTEX_FLOATS !== 0) {
        throw new RangeError("Mesh vertex data has an invalid stride");
    }
}

function chunkKey(position) {
    if (!position || typeof position.key !== "function") {
        throw new TypeError("chunk position must provide key()");
    }
    return position.key();
}

async function loadText(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load shader resource ${url.pathname}: HTTP ${response.status}`);
    }
    return response.text();
}

export function assertNoGlErrors(gl, label) {
    const errors = [];
    for (let error = gl.getError(); error !== gl.NO_ERROR; error = gl.getError()) {
        errors.push(ERROR_NAMES.get(error) ?? `0x${error.toString(16)}`);
    }
    if (errors.length) throw new Error(`WebGL error during ${label}: ${errors.join(", ")}`);
}
