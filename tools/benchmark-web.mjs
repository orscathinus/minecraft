#!/usr/bin/env node
import { runTechTestBenchmark } from "../web/benchmark.mjs";
import { WorldConfig } from "../web/world-config.mjs";

const options = parseArguments(process.argv.slice(2));
const result = await runTechTestBenchmark({ seed: options.seed });
if (options.json) {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log("Cave Game Tech Test benchmark");
    console.log(`Seed: ${result.seed}`);
    console.log(`Total world generation: ${result.totalWorldGenerationMs.toFixed(2)} ms`);
    console.log(`  Terrain: ${result.terrainGenerationMs.toFixed(2)} ms`);
    console.log(`  Caves: ${result.caveGenerationMs.toFixed(2)} ms`);
    console.log(`  Sunlight: ${result.sunlightGenerationMs.toFixed(2)} ms`);
    console.log(`Average chunk mesh: ${result.averageChunkMeshMs.toFixed(3)} ms`);
    console.log(`Maximum chunk mesh: ${result.maximumChunkMeshMs.toFixed(3)} ms`);
    console.log(`Visible faces: ${result.totalVisibleFaces}`);
    console.log(`Triangles: ${result.totalTriangles}`);
    console.log(`Peak pending chunks: ${result.peakPendingChunks}`);
    console.log(`Block arrays: ${result.blockArrayBytes} bytes`);
    console.log(`Chunk meshes: ${result.chunkMeshBytes} bytes`);
    console.log(`Hidden faces omitted: ${result.hiddenFacesOmitted}`);
}

function parseArguments(args) {
    let seed = WorldConfig.defaultSeed;
    let json = false;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--json") {
            json = true;
            continue;
        }
        if (argument === "--seed") {
            const value = Number(args[index + 1]);
            if (!Number.isSafeInteger(value)) throw new Error("--seed requires a safe integer");
            seed = value;
            index += 1;
            continue;
        }
        throw new Error(`Unknown benchmark option: ${argument}`);
    }
    return { seed, json };
}
