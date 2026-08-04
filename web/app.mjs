import { ChunkMesher } from "./chunk-mesher.mjs";
import { DebugCamera } from "./debug-camera.mjs";
import { FixedStepTimer } from "./fixed-step-timer.mjs";
import { perspectiveMatrix } from "./math.mjs";
import { VoxelRenderer } from "./renderer.mjs";
import { createDeterministicTestWorld } from "./test-chunk.mjs";

const SKY_RED = 127 / 255;
const SKY_GREEN = 204 / 255;
const SKY_BLUE = 1;
const MAX_DEVICE_PIXEL_RATIO = 2;
const FIELD_OF_VIEW_RADIANS = 70 * Math.PI / 180;

class BrowserGame {
    #canvas;
    #status;
    #renderer;
    #camera;
    #gl;
    #chunkMesh;
    #timer = new FixedStepTimer({
        updatesPerSecond: 60,
        maxFrameDeltaSeconds: 0.25,
        maxUpdatesPerFrame: 5,
    });
    #animationFrame = 0;
    #running = false;
    #closed = false;
    #resizeObserver = null;
    #listeners = [];
    #verifiedGeometry = false;

    static async create(canvas, status) {
        const gl = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            depth: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        });
        if (!gl) {
            throw new Error("WebGL 2 is unavailable. Use a current browser with hardware acceleration enabled.");
        }

        status.textContent = "Building the deterministic Phase 3 test chunk…";
        const renderer = await VoxelRenderer.create(gl);
        const { world, chunk } = createDeterministicTestWorld();
        const chunkMesh = new ChunkMesher().build(chunk, world);
        renderer.setMesh(chunkMesh);
        return new BrowserGame(canvas, status, gl, renderer, chunkMesh);
    }

    constructor(canvas, status, gl, renderer, chunkMesh) {
        this.#canvas = canvas;
        this.#status = status;
        this.#gl = gl;
        this.#renderer = renderer;
        this.#chunkMesh = chunkMesh;
        this.#camera = new DebugCamera(canvas);
    }

    start() {
        console.info("Starting Cave Game Phase 3 chunk renderer.");
        console.info("WebGL version:", this.#gl.getParameter(this.#gl.VERSION));
        console.info("Chunk faces:", this.#chunkMesh.faceCount);
        this.#gl.clearColor(SKY_RED, SKY_GREEN, SKY_BLUE, 1);
        this.#installListeners();
        this.#resize();
        this.#running = true;
        this.#timer.reset(performance.now());
        this.#animationFrame = requestAnimationFrame(this.#frame);
    }

    stop(message = "Application stopped. Reload the page to restart.") {
        if (!this.#running) return;
        this.#running = false;
        cancelAnimationFrame(this.#animationFrame);
        this.#animationFrame = 0;
        this.#status.textContent = message;
        this.#status.hidden = false;
        document.documentElement.dataset.appState = "stopped";
    }

    close(message) {
        if (this.#closed) return;
        if (this.#running) this.stop(message);
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        for (const [target, type, listener, options] of this.#listeners) {
            target.removeEventListener(type, listener, options);
        }
        this.#listeners = [];
        this.#camera.dispose();
        this.#renderer.dispose();
        this.#closed = true;
    }

    #frame = timestamp => {
        if (!this.#running) return;
        try {
            const frame = this.#timer.advance(timestamp);
            for (let index = 0; index < frame.updateCount; index += 1) {
                this.#camera.update(this.#timer.stepSeconds);
            }
            this.#render(frame.interpolationAlpha);
            this.#animationFrame = requestAnimationFrame(this.#frame);
        } catch (failure) {
            const message = `Rendering stopped: ${failure instanceof Error ? failure.message : String(failure)}`;
            this.close(message);
            showRuntimeFailure(this.#status, failure);
        }
    };

    #render(interpolationAlpha) {
        if (interpolationAlpha < 0 || interpolationAlpha >= 1) {
            throw new Error("Interpolation alpha must be in [0, 1)");
        }
        this.#resize();
        const projection = perspectiveMatrix(
            FIELD_OF_VIEW_RADIANS,
            this.#canvas.width / this.#canvas.height,
            0.05,
            256,
        );
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);
        this.#renderer.render(projection, this.#camera.viewMatrix());
        if (!this.#verifiedGeometry) {
            verifyGeometryWasDrawn(this.#gl, this.#canvas);
            this.#verifiedGeometry = true;
        }
        this.#status.hidden = true;
        Object.assign(document.documentElement.dataset, {
            appState: "running",
            webgl: "2",
            phase: "3",
            drawCalls: String(this.#renderer.drawCalls),
            glErrors: "0",
            geometry: "visible",
            chunkCount: "1",
            chunkFaces: String(this.#chunkMesh.faceCount),
        });
    }

    #resize() {
        const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DEVICE_PIXEL_RATIO);
        const width = Math.max(1, Math.round(this.#canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(this.#canvas.clientHeight * ratio));
        if (this.#canvas.width !== width || this.#canvas.height !== height) {
            this.#canvas.width = width;
            this.#canvas.height = height;
            this.#gl.viewport(0, 0, width, height);
        }
    }

    #installListeners() {
        this.#listen(window, "keydown", event => {
            if (event.code !== "Escape" || document.pointerLockElement === this.#canvas) return;
            event.preventDefault();
            this.close("Application stopped and graphics resources were released. Close this tab or reload to restart.");
        });
        this.#listen(document, "visibilitychange", () => {
            if (!document.hidden && this.#running) this.#timer.reset(performance.now());
        });
        this.#listen(this.#canvas, "webglcontextlost", event => {
            event.preventDefault();
            this.close("The WebGL context was lost. Reload the page to restart.");
        });
        this.#listen(window, "pagehide", () => this.close(), { once: true });
        this.#listen(window, "resize", () => this.#resize());
        if ("ResizeObserver" in window) {
            this.#resizeObserver = new ResizeObserver(() => this.#resize());
            this.#resizeObserver.observe(this.#canvas);
        }
    }

    #listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this.#listeners.push([target, type, listener, options]);
    }
}

function verifyGeometryWasDrawn(gl, canvas) {
    const width = Math.min(canvas.width, 512);
    const height = Math.min(canvas.height, 512);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(
        Math.floor((canvas.width - width) / 2),
        Math.floor((canvas.height - height) / 2),
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
    );
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] !== 127 || pixels[index + 1] !== 204 || pixels[index + 2] !== 255) return;
    }
    throw new Error("The chunk mesh did not produce any visible pixels");
}

function showStartupFailure(status, failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    status.textContent = `Unable to start: ${message}`;
    status.hidden = false;
    document.documentElement.dataset.appState = "failed";
    console.error("Cave Game browser startup failed.", failure);
}

function showRuntimeFailure(status, failure) {
    document.documentElement.dataset.appState = "failed";
    document.documentElement.dataset.glErrors = "1";
    status.hidden = false;
    console.error("Cave Game browser rendering failed.", failure);
}

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#status");
if (!(canvas instanceof HTMLCanvasElement) || !(status instanceof HTMLElement)) {
    throw new Error("Required browser application elements are missing");
}
try {
    const game = await BrowserGame.create(canvas, status);
    game.start();
} catch (failure) {
    showStartupFailure(status, failure);
}
