import { WorldConfig } from "./world-config.mjs";

export const DiagnosticsConfig = Object.freeze({
    metadataUpdateFrames: 15,
    frameHistorySize: 240,
    blockArrayBytes: WorldConfig.chunkCount
        * WorldConfig.chunkWidth
        * WorldConfig.height
        * WorldConfig.chunkDepth,
    sunlightBytes: WorldConfig.sizeX * WorldConfig.sizeZ,
});

export class RuntimeDiagnostics {
    #worldGenerationMs = 0;
    #caveGenerationMs = 0;
    #sunlightGenerationMs = 0;
    #frameSamples = new Float32Array(DiagnosticsConfig.frameHistorySize);
    #frameIndex = 0;
    #frameCount = 0;
    #frameSum = 0;
    #lastTimestamp = null;
    #lastFrameMs = 0;
    #peakFrameMs = 0;

    setGenerationDurations(worldGenerationMs, caveGenerationMs, sunlightGenerationMs) {
        this.#worldGenerationMs = finiteDuration(worldGenerationMs, "world generation");
        this.#caveGenerationMs = finiteDuration(caveGenerationMs, "cave generation");
        this.#sunlightGenerationMs = finiteDuration(sunlightGenerationMs, "sunlight generation");
    }

    recordFrame(timestamp) {
        if (!Number.isFinite(timestamp)) throw new TypeError("frame timestamp must be finite");
        if (this.#lastTimestamp === null) {
            this.#lastTimestamp = timestamp;
            return;
        }
        const duration = Math.max(0, timestamp - this.#lastTimestamp);
        this.#lastTimestamp = timestamp;
        const replaced = this.#frameSamples[this.#frameIndex];
        this.#frameSamples[this.#frameIndex] = duration;
        this.#frameIndex = (this.#frameIndex + 1) % this.#frameSamples.length;
        if (this.#frameCount < this.#frameSamples.length) this.#frameCount += 1;
        else this.#frameSum -= replaced;
        this.#frameSum += duration;
        this.#lastFrameMs = duration;
        if (duration > this.#peakFrameMs) this.#peakFrameMs = duration;
    }

    resetFrameClock(timestamp = null) {
        if (timestamp !== null && !Number.isFinite(timestamp)) {
            throw new TypeError("frame timestamp must be finite or null");
        }
        this.#lastTimestamp = timestamp;
    }

    writeSnapshot(target, chunkState, rendererState) {
        if (!target || typeof target !== "object") throw new TypeError("diagnostics target must be an object");
        target.worldGenerationMs = this.#worldGenerationMs;
        target.caveGenerationMs = this.#caveGenerationMs;
        target.sunlightGenerationMs = this.#sunlightGenerationMs;
        target.totalPreparationMs = this.#worldGenerationMs + this.#caveGenerationMs + this.#sunlightGenerationMs;
        target.lastFrameMs = this.#lastFrameMs;
        target.averageFrameMs = this.#frameCount === 0 ? 0 : this.#frameSum / this.#frameCount;
        target.peakFrameMs = this.#peakFrameMs;
        target.frameSamples = this.#frameCount;
        target.averageChunkMeshMs = chunkState.averageChunkMeshMs ?? 0;
        target.totalChunkMeshMs = chunkState.totalChunkMeshMs ?? 0;
        target.maximumChunkMeshMs = chunkState.maximumChunkMeshMs ?? 0;
        target.totalUploadMs = rendererState.totalUploadMs ?? 0;
        target.averageUploadMs = rendererState.averageUploadMs ?? 0;
        target.totalFaces = rendererState.faceCount ?? 0;
        target.totalTriangles = rendererState.triangleCount ?? 0;
        target.renderedTriangles = rendererState.renderedTriangles ?? 0;
        target.drawCalls = rendererState.drawCalls ?? 0;
        target.frustumCulledChunks = rendererState.frustumCulledChunks ?? 0;
        target.blockArrayBytes = DiagnosticsConfig.blockArrayBytes;
        target.sunlightBytes = DiagnosticsConfig.sunlightBytes;
        target.chunkMeshBytes = rendererState.meshBytes ?? 0;
        target.peakChunkMeshBytes = rendererState.peakMeshBytes ?? 0;
        target.peakPendingChunks = chunkState.peakPendingChunks ?? chunkState.queued ?? 0;
        target.liveGpuMeshes = rendererState.liveGpuMeshes ?? 0;
        target.liveGpuBuffers = rendererState.liveGpuBuffers ?? 0;
        target.unnecessaryDuplicateUploads = chunkState.unnecessaryDuplicateUploads ?? 0;
        return target;
    }
}

export function performanceNow() {
    return globalThis.performance?.now?.() ?? Date.now();
}

function finiteDuration(value, label) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} duration must be non-negative and finite`);
    return value;
}
