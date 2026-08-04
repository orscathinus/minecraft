import { BlockType, isOpaqueBlock } from "./block-type.mjs";
import {
    ChunkManager,
    ChunkProcessingMode,
} from "./chunk-manager.mjs";
import { CaveGenerator } from "./cave-generator.mjs";
import { FirstPersonPlayer } from "./first-person-player.mjs";
import { FixedStepTimer } from "./fixed-step-timer.mjs";
import { perspectiveMatrix } from "./math.mjs";
import { PlayerConfig } from "./player-physics.mjs";
import { VoxelRenderer } from "./renderer.mjs";
import { LightingConfig, SunlightModel } from "./sunlight.mjs";
import { SeededTerrainGenerator } from "./terrain-generator.mjs";
import { WorldConfig } from "./world-config.mjs";

const SKY_RED = 127 / 255;
const SKY_GREEN = 204 / 255;
const SKY_BLUE = 1;
const MAX_DEVICE_PIXEL_RATIO = 2;
const FIELD_OF_VIEW_RADIANS = 70 * Math.PI / 180;

class BrowserGame {
    #canvas;
    #status;
    #debugOverlay;
    #renderer;
    #player;
    #chunkManager;
    #gl;
    #seed;
    #terrainRange;
    #caveResult;
    #entrance;
    #debugVisible;
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

    static async create(canvas, status, debugOverlay) {
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

        const seed = readSeed();
        const generator = new SeededTerrainGenerator(seed);
        console.info(`Generating finite world with seed ${seed}.`);
        status.textContent = `Generating finite world · seed ${seed} · 0%`;
        const world = await generator.generateWorld({
            onProgress(completed, total) {
                const percent = Math.round(completed / total * 100);
                status.textContent = `Generating finite world · seed ${seed} · ${percent}%`;
                if (completed % 16 === 0 || completed === total) {
                    console.info(`World generation: ${completed}/${total} chunks (${percent}%).`);
                }
            },
        });

        status.textContent = "Carving primitive caves · 0%";
        const caveResult = await new CaveGenerator(seed).carveWorld(world, {
            onProgress(completed, total) {
                const percent = Math.round(completed / total * 100);
                status.textContent = `Carving primitive caves · ${percent}%`;
                console.info(`Cave generation: ${completed}/${total} passes (${percent}%).`);
            },
        });
        console.info("Cave blocks carved:", caveResult.carvedBlocks);
        console.info("Deepest cave Y:", caveResult.minimumCarvedY);
        console.info("Surface openings:", caveResult.surfaceOpenings);
        console.info("Chunks marked for remeshing:", caveResult.affectedChunks.length);

        status.textContent = "Calculating BRIGHT / DARK sunlight · 0%";
        const sunlight = new SunlightModel(world);
        await sunlight.rebuildAll({
            onProgress(completed, total) {
                const percent = Math.round(completed / total * 100);
                status.textContent = `Calculating BRIGHT / DARK sunlight · ${percent}%`;
                if (completed % 32 === 0 || completed === total) {
                    console.info(`Sunlight columns: ${completed}/${total} rows (${percent}%).`);
                }
            },
        });

        status.textContent = "Preparing the nearest player chunk…";
        world.clearDirtyChunks();
        world.clearDirtyLightingColumns?.();
        const renderer = await VoxelRenderer.create(gl);
        const terrainRange = measureTerrainRange(generator);
        const entrance = findNearestSurfaceEntrance(world, generator);
        const spawn = findSpawnNearEntrance(world, entrance);
        const game = new BrowserGame(
            canvas,
            status,
            debugOverlay,
            gl,
            renderer,
            world,
            sunlight,
            seed,
            terrainRange,
            caveResult,
            entrance,
            spawn,
            readLoadingMode(),
            readDebugEnabled(),
        );
        game.#chunkManager.processFrame({ maxChunks: 1, ignoreInterval: true });
        return game;
    }

    constructor(
        canvas,
        status,
        debugOverlay,
        gl,
        renderer,
        world,
        sunlight,
        seed,
        terrainRange,
        caveResult,
        entrance,
        spawn,
        loadingMode,
        debugVisible,
    ) {
        this.#canvas = canvas;
        this.#status = status;
        this.#debugOverlay = debugOverlay;
        this.#gl = gl;
        this.#renderer = renderer;
        this.#seed = seed;
        this.#terrainRange = terrainRange;
        this.#caveResult = caveResult;
        this.#entrance = entrance;
        this.#debugVisible = debugVisible;
        this.#player = new FirstPersonPlayer(canvas, world, {
            position: spawn.position,
            yaw: spawn.yaw,
            pitch: -0.20,
        });
        this.#chunkManager = new ChunkManager(world, sunlight, renderer, {
            playerPosition: spawn.position,
            mode: loadingMode,
        });
    }

    start() {
        const chunkState = this.#chunkManager.snapshot();
        console.info("Starting Cave Game Phase 9 proximity chunk renderer.");
        console.info("WebGL version:", this.#gl.getParameter(this.#gl.VERSION));
        console.info("Chunk processing mode:", chunkState.mode);
        console.info("Initial player chunk:", chunkState.playerChunk.key());
        console.info("Player dimensions:", PlayerConfig.width, "×", PlayerConfig.height);
        this.#gl.clearColor(SKY_RED, SKY_GREEN, SKY_BLUE, 1);
        this.#debugOverlay.hidden = !this.#debugVisible;
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
        for (const [target, type, listener, options] of this.#listeners) {
            target.removeEventListener(type, listener, options);
        }
        this.#listeners = [];
        this.#player.dispose();
        this.#chunkManager.dispose();
        this.#renderer.dispose();
        this.#closed = true;
    }

    #frame = timestamp => {
        if (!this.#running) return;
        try {
            const frame = this.#timer.advance(timestamp);
            for (let index = 0; index < frame.updateCount; index += 1) {
                this.#player.update(this.#timer.stepSeconds);
            }
            const position = this.#player.position;
            this.#chunkManager.updatePlayerPosition(position[0], position[2]);
            this.#chunkManager.processFrame();
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
            512,
        );
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);
        this.#renderer.render(projection, this.#player.viewMatrix());
        const rendererState = this.#renderer.stats();
        if (!this.#verifiedGeometry && rendererState.visibleChunks > 0) {
            verifyGeometryWasDrawn(this.#gl, this.#canvas);
            this.#verifiedGeometry = true;
        }
        this.#status.hidden = true;
        const playerState = this.#player.snapshot();
        const chunks = this.#chunkManager.snapshot();
        this.#updateDebugOverlay(chunks, rendererState);
        Object.assign(document.documentElement.dataset, {
            appState: "running",
            webgl: "2",
            phase: "9",
            drawCalls: String(rendererState.drawCalls),
            glErrors: "0",
            geometry: this.#verifiedGeometry ? "visible" : "pending",
            chunkCount: String(chunks.totalChunks),
            chunksQueued: String(chunks.queued),
            chunksMeshed: String(chunks.meshed),
            chunksVisible: String(chunks.visible),
            chunkProcessingMode: chunks.mode,
            chunkMaxPerFrame: String(chunks.maxChunksPerFrame),
            chunkFrameInterval: String(chunks.frameInterval),
            chunkPriority: "squared-horizontal-distance",
            chunkTieBreak: "z-then-x",
            staleWorkPolicy: "epoch-reprioritize",
            playerChunk: chunks.playerChunk.key(),
            firstVisibleChunk: chunks.firstVisibleChunk?.key() ?? "none",
            lastProcessedChunk: chunks.lastProcessedChunk?.key() ?? "none",
            chunkLoadingComplete: String(chunks.complete),
            chunkUploads: String(chunks.totalUploads),
            unnecessaryDuplicateUploads: String(chunks.unnecessaryDuplicateUploads),
            worldFaces: String(rendererState.faceCount),
            brightFaces: String(rendererState.brightFaceCount),
            darkFaces: String(rendererState.darkFaceCount),
            worldBounds: "0-255,0-63,0-255",
            terrainRange: `${WorldConfig.surfaceMinY}-${WorldConfig.surfaceMaxY}`,
            actualTerrainRange: `${this.#terrainRange.min}-${this.#terrainRange.max}`,
            seed: String(this.#seed),
            caveAlgorithm: "seeded-sphere-worms",
            caveCarvedBlocks: String(this.#caveResult.carvedBlocks),
            caveMinimumY: String(this.#caveResult.minimumCarvedY),
            caveSurfaceOpenings: String(this.#caveResult.surfaceOpenings),
            caveAffectedChunks: String(this.#caveResult.affectedChunks.length),
            caveBottomSolid: "true",
            caveEntrance: `${this.#entrance.x},${this.#entrance.y},${this.#entrance.z}`,
            lightingModel: "binary-column-sunlight",
            lightingStates: "2",
            brightBrightness: LightingConfig.brightBrightness.toFixed(2),
            darkBrightness: LightingConfig.darkBrightness.toFixed(2),
            darkFog: "black-stepped-distance",
            darkFogStart: LightingConfig.darkFogStart.toFixed(1),
            darkFogEnd: LightingConfig.darkFogEnd.toFixed(1),
            brightFog: "none",
            fragmentWorldRaycasts: "0",
            skyColor: "#7FCCFF",
            playerWidth: PlayerConfig.width.toFixed(2),
            playerHeight: PlayerConfig.height.toFixed(2),
            playerEyeHeight: PlayerConfig.eyeHeight.toFixed(2),
            playerGrounded: String(playerState.grounded),
            playerModel: "none",
            controls: "wasd-space-mouse-f3-h",
        });
    }

    #updateDebugOverlay(chunks, rendererState) {
        if (!this.#debugVisible) return;
        this.#debugOverlay.textContent = [
            "CHUNK PROCESSING",
            `Player chunk: ${chunks.playerChunk.key()}`,
            `Queued: ${chunks.queued}`,
            `Meshed: ${chunks.meshed}`,
            `Visible: ${chunks.visible}`,
            `Draw calls: ${rendererState.drawCalls}`,
            `Mode: ${chunks.mode}`,
            `Budget: ${chunks.maxChunksPerFrame} / ${chunks.frameInterval} frame(s)`,
            "F3 overlay · H mode",
        ].join("\n");
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
            if (event.code === "F3") {
                event.preventDefault();
                this.#debugVisible = !this.#debugVisible;
                this.#debugOverlay.hidden = !this.#debugVisible;
                return;
            }
            if (event.code === "KeyH" && !event.repeat) {
                event.preventDefault();
                const mode = this.#chunkManager.toggleMode();
                console.info(`Chunk processing mode changed to ${mode}.`);
                return;
            }
            if (event.code !== "Escape" || document.pointerLockElement === this.#canvas) return;
            event.preventDefault();
            this.close("Application stopped and graphics resources were released. Close this tab or reload to restart.");
        });
        this.#listen(document, "visibilitychange", () => {
            if (!document.hidden && this.#running) {
                this.#player.resetInput();
                this.#timer.reset(performance.now());
            }
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

function readSeed() {
    const value = new URLSearchParams(window.location.search).get("seed");
    if (value === null || value.trim() === "") return WorldConfig.defaultSeed;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : WorldConfig.defaultSeed;
}

function readLoadingMode() {
    return new URLSearchParams(window.location.search).get("loading") === "historical"
        ? ChunkProcessingMode.HISTORICAL
        : ChunkProcessingMode.NORMAL;
}

function readDebugEnabled() {
    const value = new URLSearchParams(window.location.search).get("debugChunks");
    return value === "1" || value === "true";
}

function findNearestSurfaceEntrance(world, generator) {
    const centerX = Math.floor(WorldConfig.sizeX / 2);
    const centerZ = Math.floor(WorldConfig.sizeZ / 2);
    let best = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
        for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
            const originalSurfaceY = generator.terrainHeight(x, z);
            if (world.getBlock(x, originalSurfaceY, z) !== BlockType.AIR) continue;
            let airDepth = 0;
            for (let y = originalSurfaceY; y >= Math.max(1, originalSurfaceY - 5); y -= 1) {
                if (world.getBlock(x, y, z) === BlockType.AIR) airDepth += 1;
            }
            if (airDepth < 3) continue;
            const distanceSquared = (x - centerX) ** 2 + (z - centerZ) ** 2;
            if (distanceSquared < bestDistanceSquared) {
                bestDistanceSquared = distanceSquared;
                best = Object.freeze({ x, y: originalSurfaceY, z });
            }
        }
    }
    return best ?? Object.freeze({ x: centerX, y: generator.terrainHeight(centerX, centerZ), z: centerZ });
}

function findSpawnNearEntrance(world, entrance) {
    for (let radius = 5; radius <= 14; radius += 1) {
        for (let index = 0; index < 24; index += 1) {
            const angle = index / 24 * Math.PI * 2;
            const x = Math.round(entrance.x + Math.cos(angle) * radius);
            const z = Math.round(entrance.z + Math.sin(angle) * radius);
            if (x < 1 || x >= WorldConfig.maxX || z < 1 || z >= WorldConfig.maxZ) continue;
            const groundY = highestSolidY(world, x, z);
            if (groundY < WorldConfig.surfaceMinY) continue;
            if (!isOpaqueBlock(world.getBlock(x, groundY, z))) continue;
            if (world.getBlock(x, groundY + 1, z) !== BlockType.AIR) continue;
            if (world.getBlock(x, groundY + 2, z) !== BlockType.AIR) continue;
            const position = Object.freeze([x + 0.5, groundY + 1, z + 0.5]);
            const deltaX = entrance.x + 0.5 - position[0];
            const deltaZ = entrance.z + 0.5 - position[2];
            return Object.freeze({ position, yaw: Math.atan2(deltaX, -deltaZ) });
        }
    }
    throw new Error("Unable to find a safe player spawn near the cave entrance");
}

function highestSolidY(world, x, z) {
    for (let y = WorldConfig.maxY; y >= WorldConfig.minY; y -= 1) {
        if (isOpaqueBlock(world.getBlock(x, y, z))) return y;
    }
    return -1;
}

function measureTerrainRange(generator) {
    let min = WorldConfig.surfaceMaxY;
    let max = WorldConfig.surfaceMinY;
    for (let z = 0; z < WorldConfig.sizeZ; z += 1) {
        for (let x = 0; x < WorldConfig.sizeX; x += 1) {
            const height = generator.terrainHeight(x, z);
            min = Math.min(min, height);
            max = Math.max(max, height);
        }
    }
    return Object.freeze({ min, max });
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
    throw new Error("The proximity-loaded cave world did not produce any visible pixels");
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
const debugOverlay = document.querySelector("#chunk-debug");
if (!(canvas instanceof HTMLCanvasElement)
    || !(status instanceof HTMLElement)
    || !(debugOverlay instanceof HTMLElement)) {
    throw new Error("Required browser application elements are missing");
}
try {
    const game = await BrowserGame.create(canvas, status, debugOverlay);
    game.start();
} catch (failure) {
    showStartupFailure(status, failure);
}
