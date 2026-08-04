import test from "node:test";
import assert from "node:assert/strict";
import { lookAtMatrix, perspectiveMatrix } from "../math.mjs";
import { DiagnosticsConfig, RuntimeDiagnostics } from "../performance-diagnostics.mjs";
import { aabbIntersectsFrustum, updateFrustumPlanes } from "../renderer.mjs";

test("runtime diagnostics reuse caller-owned snapshots and report exact memory", () => {
    const diagnostics = new RuntimeDiagnostics();
    diagnostics.setGenerationDurations(10, 4, 2);
    diagnostics.recordFrame(100);
    diagnostics.recordFrame(116);
    diagnostics.recordFrame(133);
    const target = {};
    const result = diagnostics.writeSnapshot(target, {
        averageChunkMeshMs: 0.5,
        totalChunkMeshMs: 128,
        maximumChunkMeshMs: 2,
        peakPendingChunks: 256,
        unnecessaryDuplicateUploads: 0,
    }, {
        totalUploadMs: 16,
        averageUploadMs: 0.0625,
        faceCount: 100,
        triangleCount: 200,
        renderedTriangles: 120,
        drawCalls: 8,
        frustumCulledChunks: 12,
        meshBytes: 4096,
        peakMeshBytes: 8192,
        liveGpuMeshes: 20,
        liveGpuBuffers: 40,
    });
    assert.equal(result, target);
    assert.equal(target.totalPreparationMs, 16);
    assert.equal(target.averageFrameMs, 16.5);
    assert.equal(target.blockArrayBytes, 4_194_304);
    assert.equal(target.sunlightBytes, 65_536);
    assert.equal(target.peakPendingChunks, 256);
    assert.equal(DiagnosticsConfig.metadataUpdateFrames, 15);
});

test("frustum planes accept chunks in front and reject chunks behind or far to the side", () => {
    const projection = perspectiveMatrix(70 * Math.PI / 180, 16 / 9, 0.05, 512);
    const view = lookAtMatrix([8, 70, 24], [8, 58, 8]);
    const clip = new Float32Array(16);
    const planes = new Float32Array(24);
    updateFrustumPlanes(projection, view, clip, planes);

    assert.equal(aabbIntersectsFrustum({
        minX: 0, minY: 0, minZ: 0,
        maxX: 16, maxY: 64, maxZ: 16,
    }, planes), true);
    assert.equal(aabbIntersectsFrustum({
        minX: 0, minY: 0, minZ: 40,
        maxX: 16, maxY: 64, maxZ: 56,
    }, planes), false);
    assert.equal(aabbIntersectsFrustum({
        minX: 400, minY: 0, minZ: 0,
        maxX: 416, maxY: 64, maxZ: 16,
    }, planes), false);
});
