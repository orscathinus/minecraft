import { BlockType } from "./block-type.mjs";
import { ChunkManager, ChunkProcessingConfig, ChunkProcessingMode } from "./chunk-manager.mjs";
import { CaveGenerator } from "./cave-generator.mjs";
import { FirstPersonPlayer } from "./first-person-player.mjs";
import { FixedStepTimer } from "./fixed-step-timer.mjs";
import { perspectiveMatrixInto } from "./math.mjs";
import { DiagnosticsConfig, performanceNow, RuntimeDiagnostics } from "./performance-diagnostics.mjs";
import { PlayerConfig, VoidSafetyConfig } from "./player-physics.mjs";
import { VoxelRenderer } from "./renderer.mjs";
import { LightingConfig, SunlightModel } from "./sunlight.mjs";
import { HistoricalSpawnController, readSpawnDebugSeed, SpawnConfig } from "./spawn-controller.mjs";
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
    #spawnController;
    #initialSpawn;
    #diagnostics;
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
    #projectionMatrix = new Float32Array(16);
    #rendererState = {};
    #chunkState = {};
    #playerState = {};
    #spawnState = {};
    #diagnosticsState = {};
    #metadataCountdown = 0;
    #verificationPixels = null;
    #verificationWidth = 0;
    #verificationHeight = 0;

    static async create(canvas, status, debugOverlay) {
        const gl = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            depth: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        });
        if (!gl) throw new Error("WebGL 2 is unavailable. Use a current browser with hardware acceleration enabled.");

        const searchParams = new URLSearchParams(window.location.search);
        const seed = readSeed(searchParams);
        const diagnostics = new RuntimeDiagnostics();
        const generator = new SeededTerrainGenerator(seed);

        const worldStarted = performanceNow();
        status.textContent = `Generating finite world · seed ${seed} · 0%`;
        const world = await generator.generateWorld({
            onProgress(completed, total) {
                status.textContent = `Generating finite world · seed ${seed} · ${Math.round(completed / total * 100)}%`;
            },
        });
        const worldGenerationMs = performanceNow() - worldStarted;

        const caveStarted = performanceNow();
        status.textContent = "Carving primitive caves · 0%";
        const caveResult = await new CaveGenerator(seed).carveWorld(world, {
            onProgress(completed, total) {
                status.textContent = `Carving primitive caves · ${Math.round(completed / total * 100)}%`;
            },
        });
        const caveGenerationMs = performanceNow() - caveStarted;

        const sunlightStarted = performanceNow();
        status.textContent = "Calculating BRIGHT / DARK sunlight · 0%";
        const sunlight = new SunlightModel(world);
        await sunlight.rebuildAll({
            onProgress(completed, total) {
                status.textContent = `Calculating BRIGHT / DARK sunlight · ${Math.round(completed / total * 100)}%`;
            },
        });
        const sunlightGenerationMs = performanceNow() - sunlightStarted;
        diagnostics.setGenerationDurations(worldGenerationMs, caveGenerationMs, sunlightGenerationMs);

        status.textContent = "Choosing historical random spawn at Y=74…";
        world.clearDirtyChunks();
        world.clearDirtyLightingColumns?.();
        const renderer = await VoxelRenderer.create(gl);
        const spawnController = new HistoricalSpawnController({
            debugSeed: readSpawnDebugSeed(searchParams),
        });
        const initialSpawn = spawnController.createInitialSpawn();
        const game = new BrowserGame({
            canvas,
            status,
            debugOverlay,
            gl,
            renderer,
            world,
            sunlight,
            seed,
            terrainRange: measureTerrainRange(generator),
            caveResult,
            entrance: findNearestSurfaceEntrance(world, generator),
            spawnController,
            initialSpawn,
            loadingMode: readLoadingMode(searchParams),
            debugVisible: readDebugEnabled(searchParams),
            diagnostics,
        });
        game.#chunkManager.processFrame({ maxChunks: 1, ignoreInterval: true, collectResults: false });
        return game;
    }

    constructor({
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
        spawnController,
        initialSpawn,
        loadingMode,
        debugVisible,
        diagnostics,
    }) {
        this.#canvas = canvas;
        this.#status = status;
        this.#debugOverlay = debugOverlay;
        this.#gl = gl;
        this.#renderer = renderer;
        this.#seed = seed;
        this.#terrainRange = terrainRange;
        this.#caveResult = caveResult;
        this.#entrance = entrance;
        this.#spawnController = spawnController;
        this.#initialSpawn = initialSpawn;
        this.#debugVisible = debugVisible;
        this.#diagnostics = diagnostics;
        this.#player = new FirstPersonPlayer(canvas, world, {
            position: initialSpawn.position,
            yaw: yawTowardSpawnChunkCenter(initialSpawn.position),
            pitch: -1.10,
            spawnController,
        });
        this.#chunkManager = new ChunkManager(world, sunlight, renderer, {
            playerPosition: initialSpawn.position,
            mode: loadingMode,
        });
    }

    start() {
        this.#chunkManager.writeSnapshot(this.#chunkState);
        this.#spawnController.writeSnapshot(this.#spawnState);
        console.info("Starting Cave Game Phase 11 profiled and stabilized browser build.");
        console.info("WebGL version:", this.#gl.getParameter(this.#gl.VERSION));
        console.info("Chunk processing mode:", this.#chunkState.mode);
        console.info("Initial player chunk:", this.#chunkState.playerChunk.key());
        console.info("Spawn random source:", this.#spawnState.source, this.#spawnState.seed);
        this.#gl.clearColor(SKY_RED, SKY_GREEN, SKY_BLUE, 1);
        this.#debugOverlay.hidden = !this.#debugVisible;
        this.#installListeners();
        this.#resize();
        this.#running = true;
        const started = performance.now();
        this.#timer.reset(started);
        this.#diagnostics.resetFrameClock(started);
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
        this.#listeners.length = 0;
        this.#player.dispose();
        this.#chunkManager.dispose();
        this.#renderer.dispose();
        this.#verificationPixels = null;
        this.#closed = true;
    }

    #frame = timestamp => {
        if (!this.#running) return;
        try {
            this.#diagnostics.recordFrame(timestamp);
            const frame = this.#timer.advance(timestamp);
            for (let index = 0; index < frame.updateCount; index += 1) {
                this.#player.advance(this.#timer.stepSeconds);
                this.#chunkManager.updatePlayerPosition(this.#player.x, this.#player.z);
            }
            this.#chunkManager.updatePlayerPosition(this.#player.x, this.#player.z);
            this.#chunkManager.processFrameFast();
            this.#render(frame.interpolationAlpha);
            this.#animationFrame = requestAnimationFrame(this.#frame);
        } catch (failure) {
            const message = `Rendering stopped: ${failure instanceof Error ? failure.message : String(failure)}`;
            this.close(message);
            showRuntimeFailure(this.#status, failure);
        }
    };

    #render(interpolationAlpha) {
        if (interpolationAlpha < 0 || interpolationAlpha >= 1) throw new Error("Interpolation alpha must be in [0, 1)");
        this.#resize();
        perspectiveMatrixInto(
            this.#projectionMatrix,
            FIELD_OF_VIEW_RADIANS,
            this.#canvas.width / this.#canvas.height,
            0.05,
            512,
        );
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);
        this.#renderer.render(this.#projectionMatrix, this.#player.viewMatrix());
        this.#renderer.writeStats(this.#rendererState);
        if (!this.#verifiedGeometry && this.#rendererState.drawCalls > 0) {
            this.#verifiedGeometry = this.#geometryWasDrawn();
        }
        this.#status.hidden = true;

        if (this.#metadataCountdown <= 0) {
            this.#metadataCountdown = DiagnosticsConfig.metadataUpdateFrames - 1;
            this.#publishDiagnostics();
        } else {
            this.#metadataCountdown -= 1;
        }
    }

    #publishDiagnostics() {
        this.#player.writeSnapshot(this.#playerState);
        this.#spawnController.writeSnapshot(this.#spawnState);
        this.#chunkManager.writeSnapshot(this.#chunkState);
        this.#renderer.writeStats(this.#rendererState);
        this.#diagnostics.writeSnapshot(this.#diagnosticsState, this.#chunkState, this.#rendererState);
        this.#updateDebugOverlay();

        Object.assign(document.documentElement.dataset, {
            appState: "running",
            webgl: "2",
            phase: "11",
            drawCalls: String(this.#rendererState.drawCalls),
            glErrors: "0",
            geometry: this.#verifiedGeometry ? "visible" : "pending",
            chunkCount: String(this.#chunkState.totalChunks),
            chunksQueued: String(this.#chunkState.queued),
            chunksMeshed: String(this.#chunkState.meshed),
            chunksVisible: String(this.#chunkState.visible),
            chunksFrustumCulled: String(this.#rendererState.frustumCulledChunks),
            chunkProcessingMode: this.#chunkState.mode,
            chunkMaxPerFrame: String(this.#chunkState.maxChunksPerFrame),
            chunkFrameInterval: String(this.#chunkState.frameInterval),
            normalMeshBudget: String(ChunkProcessingConfig.normal.maxChunksPerFrame),
            historicalMeshBudget: String(ChunkProcessingConfig.historical.maxChunksPerFrame),
            historicalFrameInterval: String(ChunkProcessingConfig.historical.frameInterval),
            chunkPriority: "squared-horizontal-distance",
            chunkTieBreak: "z-then-x",
            staleWorkPolicy: "epoch-reprioritize",
            playerChunk: this.#chunkState.playerChunk.key(),
            firstVisibleChunk: this.#chunkState.firstVisibleChunk?.key() ?? "none",
            lastProcessedChunk: this.#chunkState.lastProcessedChunk?.key() ?? "none",
            chunkLoadingComplete: String(this.#chunkState.complete),
            chunkUploads: String(this.#chunkState.totalUploads),
            unnecessaryDuplicateUploads: String(this.#chunkState.unnecessaryDuplicateUploads),
            worldFaces: String(this.#rendererState.faceCount),
            worldTriangles: String(this.#rendererState.triangleCount),
            renderedTriangles: String(this.#rendererState.renderedTriangles),
            brightFaces: String(this.#rendererState.brightFaceCount),
            darkFaces: String(this.#rendererState.darkFaceCount),
            hiddenFacesOmitted: "true",
            frustumCulling: "true",
            distanceCulling: "false",
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
            spawnModel: "historical-random-xz-y74",
            spawnY: String(SpawnConfig.y),
            spawnRange: "0.5-255.5",
            spawnRandomSource: this.#spawnState.source,
            spawnRandomSeed: String(this.#spawnState.seed),
            spawnDebugSeed: this.#spawnState.debugSeed === null ? "none" : String(this.#spawnState.debugSeed),
            initialSpawn: formatPosition(this.#initialSpawn.position),
            lastSpawn: formatPositionXYZ(this.#spawnState.lastX, this.#spawnState.lastY, this.#spawnState.lastZ),
            totalSpawns: String(this.#spawnState.totalSpawns),
            respawnCount: String(this.#spawnState.respawnCount),
            respawnHeld: String(this.#playerState.rHeld),
            respawnPerFixedUpdate: "true",
            playerX: this.#playerState.x.toFixed(3),
            playerY: this.#playerState.y.toFixed(3),
            playerZ: this.#playerState.z.toFixed(3),
            playerVelocityX: this.#playerState.velocityX.toFixed(3),
            playerVelocityY: this.#playerState.velocityY.toFixed(3),
            playerVelocityZ: this.#playerState.velocityZ.toFixed(3),
            playerBelowWorld: String(this.#playerState.belowWorld),
            automaticVoidRespawn: "false",
            lowerYClamp: "false",
            horizontalWorldClamp: "false",
            voidSafetyLimit: String(VoidSafetyConfig.coordinateLimit),
            voidSafetyRebase: String(VoidSafetyConfig.rebaseMagnitude),
            voidSafetyRebases: String(this.#playerState.voidSafetyRebases),
            playerWidth: PlayerConfig.width.toFixed(2),
            playerHeight: PlayerConfig.height.toFixed(2),
            playerEyeHeight: PlayerConfig.eyeHeight.toFixed(2),
            playerGrounded: String(this.#playerState.grounded),
            playerModel: "none",
            controls: "wasd-space-r-mouse-f3-h",
            profiling: "runtime-and-command",
            worldGenerationMs: this.#diagnosticsState.worldGenerationMs.toFixed(3),
            caveGenerationMs: this.#diagnosticsState.caveGenerationMs.toFixed(3),
            sunlightGenerationMs: this.#diagnosticsState.sunlightGenerationMs.toFixed(3),
            averageChunkMeshMs: this.#diagnosticsState.averageChunkMeshMs.toFixed(3),
            totalChunkMeshMs: this.#diagnosticsState.totalChunkMeshMs.toFixed(3),
            averageUploadMs: this.#diagnosticsState.averageUploadMs.toFixed(3),
            totalUploadMs: this.#diagnosticsState.totalUploadMs.toFixed(3),
            averageFrameMs: this.#diagnosticsState.averageFrameMs.toFixed(3),
            peakFrameMs: this.#diagnosticsState.peakFrameMs.toFixed(3),
            blockArrayBytes: String(this.#diagnosticsState.blockArrayBytes),
            sunlightBytes: String(this.#diagnosticsState.sunlightBytes),
            chunkMeshBytes: String(this.#diagnosticsState.chunkMeshBytes),
            peakChunkMeshBytes: String(this.#diagnosticsState.peakChunkMeshBytes),
            peakPendingChunks: String(this.#diagnosticsState.peakPendingChunks),
            liveGpuMeshes: String(this.#diagnosticsState.liveGpuMeshes),
            liveGpuBuffers: String(this.#diagnosticsState.liveGpuBuffers),
            hotPathAllocationPolicy: "reused-typed-arrays-and-snapshots",
            metadataUpdateFrames: String(DiagnosticsConfig.metadataUpdateFrames),
            unchangedChunkRebuilds: "false",
            threadModel: "single-render-thread",
            workerThreads: "0",
            gpuUploadsThread: "rendering-thread",
        });
    }

    #updateDebugOverlay() {
        if (!this.#debugVisible) return;
        this.#debugOverlay.textContent = [
            "PHASE 11 DIAGNOSTICS",
            `Player chunk: ${this.#chunkState.playerChunk.key()}`,
            `Position: ${formatPositionXYZ(this.#playerState.x, this.#playerState.y, this.#playerState.z)}`,
            `Queued / visible: ${this.#chunkState.queued} / ${this.#chunkState.visible}`,
            `Drawn / culled: ${this.#rendererState.drawCalls} / ${this.#rendererState.frustumCulledChunks}`,
            `Triangles: ${this.#rendererState.renderedTriangles} rendered`,
            `Frame avg / peak: ${this.#diagnosticsState.averageFrameMs.toFixed(2)} / ${this.#diagnosticsState.peakFrameMs.toFixed(2)} ms`,
            `Mesh avg: ${this.#diagnosticsState.averageChunkMeshMs.toFixed(3)} ms`,
            `GPU mesh memory: ${(this.#diagnosticsState.chunkMeshBytes / 1048576).toFixed(2)} MiB`,
            `Mode: ${this.#chunkState.mode}`,
            `Respawns: ${this.#playerState.respawnCount}`,
            "F3 diagnostics · H loading · hold R respawn",
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

    #geometryWasDrawn() {
        const width = Math.min(this.#canvas.width, 512);
        const height = Math.min(this.#canvas.height, 512);
        if (!this.#verificationPixels || width !== this.#verificationWidth || height !== this.#verificationHeight) {
            this.#verificationWidth = width;
            this.#verificationHeight = height;
            this.#verificationPixels = new Uint8Array(width * height * 4);
        }
        this.#gl.readPixels(
            Math.floor((this.#canvas.width - width) / 2),
            Math.floor((this.#canvas.height - height) / 2),
            width,
            height,
            this.#gl.RGBA,
            this.#gl.UNSIGNED_BYTE,
            this.#verificationPixels,
        );
        for (let index = 0; index < this.#verificationPixels.length; index += 4) {
            if (this.#verificationPixels[index] !== 127
                || this.#verificationPixels[index + 1] !== 204
                || this.#verificationPixels[index + 2] !== 255) return true;
        }
        return false;
    }

    #installListeners() {
        this.#listen(window, "keydown", event => {
            if (event.code === "F3") {
                event.preventDefault();
                this.#debugVisible = !this.#debugVisible;
                this.#debugOverlay.hidden = !this.#debugVisible;
                this.#metadataCountdown = 0;
                return;
            }
            if (event.code === "KeyH" && !event.repeat) {
                event.preventDefault();
                console.info(`Chunk processing mode changed to ${this.#chunkManager.toggleMode()}.`);
                this.#metadataCountdown = 0;
                return;
            }
            if (event.code !== "Escape" || document.pointerLockElement === this.#canvas) return;
            event.preventDefault();
            this.close("Application stopped and graphics resources were released. Close this tab or reload to restart.");
        });
        this.#listen(document, "visibilitychange", () => {
            if (!document.hidden && this.#running) {
                this.#player.resetInput();
                const timestamp = performance.now();
                this.#timer.reset(timestamp);
                this.#diagnostics.resetFrameClock(timestamp);
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

function readSeed(searchParams) {
    const value = searchParams.get("seed");
    if (value === null || value.trim() === "") return WorldConfig.defaultSeed;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : WorldConfig.defaultSeed;
}

function readLoadingMode(searchParams) {
    return searchParams.get("loading") === "historical"
        ? ChunkProcessingMode.HISTORICAL
        : ChunkProcessingMode.NORMAL;
}

function readDebugEnabled(searchParams) {
    const value = searchParams.get("debugChunks");
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

function yawTowardSpawnChunkCenter(position) {
    const chunkX = Math.floor(position[0] / WorldConfig.chunkWidth);
    const chunkZ = Math.floor(position[2] / WorldConfig.chunkDepth);
    const targetX = chunkX * WorldConfig.chunkWidth + WorldConfig.chunkWidth / 2;
    const targetZ = chunkZ * WorldConfig.chunkDepth + WorldConfig.chunkDepth / 2;
    const deltaX = targetX - position[0];
    const deltaZ = targetZ - position[2];
    if (deltaX === 0 && deltaZ === 0) return 0;
    return Math.atan2(deltaX, -deltaZ);
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

function formatPosition(position) {
    return formatPositionXYZ(position[0], position[1], position[2]);
}

function formatPositionXYZ(x, y, z) {
    return `${Number(x).toFixed(3)},${Number(y).toFixed(3)},${Number(z).toFixed(3)}`;
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
