import { ChunkMesher } from "./chunk-mesher.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { WorldConfig } from "./world-config.mjs";

export const ChunkProcessingMode = Object.freeze({
    NORMAL: "normal",
    HISTORICAL: "historical",
});

export const ChunkProcessingConfig = Object.freeze({
    [ChunkProcessingMode.NORMAL]: Object.freeze({
        maxChunksPerFrame: 2,
        frameInterval: 1,
    }),
    [ChunkProcessingMode.HISTORICAL]: Object.freeze({
        maxChunksPerFrame: 1,
        frameInterval: 10,
    }),
});

export class ChunkPriorityQueue {
    #items = [];

    enqueue(item) {
        validateQueueItem(item);
        this.#items.push(item);
        this.#bubbleUp(this.#items.length - 1);
    }

    dequeue() {
        if (this.#items.length === 0) return null;
        const first = this.#items[0];
        const last = this.#items.pop();
        if (this.#items.length > 0) {
            this.#items[0] = last;
            this.#bubbleDown(0);
        }
        return first;
    }

    clear() { this.#items.length = 0; }
    get size() { return this.#items.length; }
    get empty() { return this.#items.length === 0; }

    #bubbleUp(startIndex) {
        let index = startIndex;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (compareWork(this.#items[parent], this.#items[index]) <= 0) break;
            const swap = this.#items[parent];
            this.#items[parent] = this.#items[index];
            this.#items[index] = swap;
            index = parent;
        }
    }

    #bubbleDown(startIndex) {
        let index = startIndex;
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;
            if (left < this.#items.length
                && compareWork(this.#items[left], this.#items[smallest]) < 0) smallest = left;
            if (right < this.#items.length
                && compareWork(this.#items[right], this.#items[smallest]) < 0) smallest = right;
            if (smallest === index) return;
            const swap = this.#items[index];
            this.#items[index] = this.#items[smallest];
            this.#items[smallest] = swap;
            index = smallest;
        }
    }
}

export class ChunkManager {
    #world;
    #sunlight;
    #renderer;
    #mesher;
    #clock;
    #queue = new ChunkPriorityQueue();
    #records = new Map();
    #playerChunk;
    #epoch = 0;
    #mode;
    #modeConfig;
    #frameCounter = 0;
    #meshedKeys = new Set();
    #visibleKeys = new Set();
    #uploadCounts = new Map();
    #queuedCount = 0;
    #peakPendingChunks = 0;
    #totalUploads = 0;
    #unnecessaryDuplicateUploads = 0;
    #firstVisibleChunk = null;
    #lastProcessedChunk = null;
    #meshJobs = 0;
    #totalChunkMeshMs = 0;
    #maximumChunkMeshMs = 0;

    constructor(world, sunlight, renderer, {
        playerPosition = [0, 0, 0],
        mode = ChunkProcessingMode.NORMAL,
        modeConfig = null,
        mesher = new ChunkMesher(),
        clock = performanceNow,
    } = {}) {
        requireWorld(world);
        requireSunlight(sunlight);
        requireRenderer(renderer);
        if (!mesher || typeof mesher.build !== "function") throw new TypeError("ChunkManager requires a chunk mesher");
        if (typeof clock !== "function") throw new TypeError("ChunkManager clock must be a function");
        this.#world = world;
        this.#sunlight = sunlight;
        this.#renderer = renderer;
        this.#mesher = mesher;
        this.#clock = clock;
        this.#mode = validateMode(mode);
        this.#modeConfig = normalizeModeConfig(modeConfig);
        this.#playerChunk = chunkFromWorldPosition(playerPosition[0], playerPosition[2]);

        for (const chunk of world.chunks()) {
            const key = chunk.position.key();
            this.#records.set(key, {
                position: chunk.position,
                state: "queued",
                reason: "initial",
                revision: 0,
            });
            this.#queuedCount += 1;
        }
        this.#peakPendingChunks = this.#queuedCount;
        this.#rebuildQueue();
    }

    updatePlayerPosition(x, z) {
        const next = chunkFromWorldPosition(x, z);
        if (next.equals(this.#playerChunk)) return false;
        this.#playerChunk = next;
        this.#rebuildQueue();
        return true;
    }

    setMode(mode) {
        const next = validateMode(mode);
        if (next === this.#mode) return false;
        this.#mode = next;
        this.#frameCounter = 0;
        return true;
    }

    toggleMode() {
        this.setMode(this.#mode === ChunkProcessingMode.NORMAL
            ? ChunkProcessingMode.HISTORICAL
            : ChunkProcessingMode.NORMAL);
        return this.#mode;
    }

    processFrame({ maxChunks = null, ignoreInterval = false, collectResults = true } = {}) {
        return this.#process(maxChunks, ignoreInterval, collectResults);
    }

    processFrameFast() {
        return this.#process(null, false, false);
    }

    queueRefresh(positionOrX, z = undefined) {
        const position = positionOrX instanceof ChunkPosition
            ? positionOrX
            : new ChunkPosition(positionOrX, z);
        const record = this.#records.get(position.key());
        if (!record) return false;
        this.#queueRecord(record, "refresh");
        this.#rebuildQueue();
        return true;
    }

    writeSnapshot(target) {
        if (!target || typeof target !== "object") throw new TypeError("chunk snapshot target must be an object");
        const config = this.#modeConfig[this.#mode];
        target.playerChunk = this.#playerChunk;
        target.queued = this.#queuedCount;
        target.meshed = this.#meshedKeys.size;
        target.visible = this.#visibleKeys.size;
        target.totalChunks = this.#records.size;
        target.mode = this.#mode;
        target.maxChunksPerFrame = config.maxChunksPerFrame;
        target.frameInterval = config.frameInterval;
        target.totalUploads = this.#totalUploads;
        target.unnecessaryDuplicateUploads = this.#unnecessaryDuplicateUploads;
        target.firstVisibleChunk = this.#firstVisibleChunk;
        target.lastProcessedChunk = this.#lastProcessedChunk;
        target.complete = this.#queuedCount === 0;
        target.epoch = this.#epoch;
        target.peakPendingChunks = this.#peakPendingChunks;
        target.meshJobs = this.#meshJobs;
        target.totalChunkMeshMs = this.#totalChunkMeshMs;
        target.averageChunkMeshMs = this.#meshJobs === 0 ? 0 : this.#totalChunkMeshMs / this.#meshJobs;
        target.maximumChunkMeshMs = this.#maximumChunkMeshMs;
        return target;
    }

    snapshot() {
        return Object.freeze(this.writeSnapshot({}));
    }

    dispose() {
        this.#queue.clear();
        this.#records.clear();
        this.#meshedKeys.clear();
        this.#visibleKeys.clear();
        this.#uploadCounts.clear();
        this.#queuedCount = 0;
    }

    #process(maxChunks, ignoreInterval, collectResults) {
        this.#enqueueDirtyChunks();
        this.#frameCounter += 1;
        const config = this.#modeConfig[this.#mode];
        if (!ignoreInterval && this.#frameCounter % config.frameInterval !== 0) {
            return collectResults ? Object.freeze([]) : 0;
        }
        const budget = maxChunks === null ? config.maxChunksPerFrame : validateBudget(maxChunks);
        const processed = collectResults ? [] : null;
        let processedCount = 0;

        while (processedCount < budget && !this.#queue.empty) {
            const work = this.#queue.dequeue();
            if (!work || work.epoch !== this.#epoch) continue;
            const record = this.#records.get(work.key);
            if (!record || record.state !== "queued" || record.revision !== work.revision) continue;
            const chunk = this.#world.getChunk(record.position);
            if (!chunk) continue;

            const started = this.#clock();
            const mesh = this.#mesher.build(chunk, this.#world, this.#sunlight);
            const meshMs = Math.max(0, this.#clock() - started);
            this.#meshJobs += 1;
            this.#totalChunkMeshMs += meshMs;
            this.#maximumChunkMeshMs = Math.max(this.#maximumChunkMeshMs, meshMs);

            const previousUploads = this.#uploadCounts.get(work.key) ?? 0;
            if (previousUploads > 0 && record.reason !== "refresh") this.#unnecessaryDuplicateUploads += 1;

            try {
                this.#renderer.uploadChunkMesh(record.position, mesh, { reason: record.reason });
            } catch (failure) {
                this.#rebuildQueue();
                throw failure;
            }

            record.state = "visible";
            this.#queuedCount -= 1;
            this.#meshedKeys.add(work.key);
            this.#uploadCounts.set(work.key, previousUploads + 1);
            this.#totalUploads += 1;
            this.#visibleKeys.add(work.key);
            if (this.#firstVisibleChunk === null) this.#firstVisibleChunk = record.position;
            this.#lastProcessedChunk = record.position;
            processedCount += 1;
            if (collectResults) {
                processed.push(Object.freeze({
                    position: record.position,
                    reason: record.reason,
                    distanceSquared: work.distanceSquared,
                    meshMilliseconds: meshMs,
                }));
            }
        }
        return collectResults ? Object.freeze(processed) : processedCount;
    }

    #enqueueDirtyChunks() {
        this.#sunlight.rebuildDirtyColumns();
        const dirty = this.#world.consumeDirtyChunkPositions?.() ?? Object.freeze([]);
        let changed = false;
        for (const position of dirty) {
            const record = this.#records.get(position.key());
            if (!record) continue;
            this.#queueRecord(record, "refresh");
            changed = true;
        }
        if (changed) this.#rebuildQueue();
    }

    #queueRecord(record, reason) {
        if (record.state !== "queued") {
            record.state = "queued";
            this.#queuedCount += 1;
            this.#peakPendingChunks = Math.max(this.#peakPendingChunks, this.#queuedCount);
        }
        record.reason = reason;
        record.revision += 1;
    }

    #rebuildQueue() {
        this.#epoch += 1;
        this.#queue.clear();
        for (const [key, record] of this.#records) {
            if (record.state !== "queued") continue;
            const dx = record.position.x - this.#playerChunk.x;
            const dz = record.position.z - this.#playerChunk.z;
            this.#queue.enqueue(Object.freeze({
                key,
                position: record.position,
                distanceSquared: dx * dx + dz * dz,
                epoch: this.#epoch,
                revision: record.revision,
            }));
        }
    }
}

export function chunkFromWorldPosition(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError("player position must be finite");
    return new ChunkPosition(
        clamp(Math.floor(x / WorldConfig.chunkWidth), 0, WorldConfig.chunksX - 1),
        clamp(Math.floor(z / WorldConfig.chunkDepth), 0, WorldConfig.chunksZ - 1),
    );
}

function compareWork(a, b) {
    return a.distanceSquared - b.distanceSquared
        || a.position.z - b.position.z
        || a.position.x - b.position.x;
}

function normalizeModeConfig(modeConfig) {
    if (modeConfig === null) return ChunkProcessingConfig;
    const result = {};
    for (const mode of Object.values(ChunkProcessingMode)) {
        const source = modeConfig[mode] ?? ChunkProcessingConfig[mode];
        result[mode] = Object.freeze({
            maxChunksPerFrame: validateBudget(source.maxChunksPerFrame),
            frameInterval: validateBudget(source.frameInterval),
        });
    }
    return Object.freeze(result);
}

function validateQueueItem(item) {
    if (!item || !(item.position instanceof ChunkPosition)
        || !Number.isInteger(item.distanceSquared) || item.distanceSquared < 0) {
        throw new TypeError("invalid chunk queue item");
    }
}

function validateMode(mode) {
    if (!Object.values(ChunkProcessingMode).includes(mode)) throw new RangeError(`Unknown chunk processing mode: ${mode}`);
    return mode;
}

function validateBudget(value) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError("chunk processing budgets must be positive integers");
    return value;
}

function requireWorld(world) {
    if (!world || typeof world.chunks !== "function" || typeof world.getChunk !== "function") {
        throw new TypeError("ChunkManager requires a finite voxel world");
    }
}

function requireSunlight(sunlight) {
    if (!sunlight || typeof sunlight.rebuildDirtyColumns !== "function") {
        throw new TypeError("ChunkManager requires a sunlight model");
    }
}

function requireRenderer(renderer) {
    if (!renderer || typeof renderer.uploadChunkMesh !== "function") {
        throw new TypeError("ChunkManager requires a chunk-capable renderer");
    }
}

function performanceNow() {
    return globalThis.performance?.now?.() ?? Date.now();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
