#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { BlockType } from "../web/block-type.mjs";
import { ChunkProcessingConfig } from "../web/chunk-manager.mjs";
import { PlayerConfig } from "../web/player-physics.mjs";
import { LightState, LightingConfig } from "../web/sunlight.mjs";
import { SpawnConfig } from "../web/spawn-controller.mjs";
import { WorldConfig } from "../web/world-config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];

check("world dimensions are exactly 256 x 64 x 256", () => {
    equal(WorldConfig.sizeX, 256);
    equal(WorldConfig.height, 64);
    equal(WorldConfig.sizeZ, 256);
    equal(WorldConfig.minX, 0); equal(WorldConfig.maxX, 255);
    equal(WorldConfig.minY, 0); equal(WorldConfig.maxY, 63);
    equal(WorldConfig.minZ, 0); equal(WorldConfig.maxZ, 255);
});

check("horizontal chunks are exactly 16 x 16 in a 16 x 16 grid", () => {
    equal(WorldConfig.chunkWidth, 16);
    equal(WorldConfig.chunkDepth, 16);
    equal(WorldConfig.chunksX, 16);
    equal(WorldConfig.chunksZ, 16);
    equal(WorldConfig.chunkCount, 256);
});

check("AIR, GRASS, and ROCK are the only block states", () => {
    deepEqual(Object.keys(BlockType).sort(), ["AIR", "GRASS", "ROCK"]);
    deepEqual(Object.values(BlockType).sort((a, b) => a - b), [0, 1, 2]);
});

check("grass eligibility is restricted to Y 57 through 63", () => {
    equal(WorldConfig.surfaceMinY, 57);
    equal(WorldConfig.surfaceMaxY, 63);
});

check("player and respawn constants match the specification", () => {
    equal(PlayerConfig.height, 1.62);
    equal(SpawnConfig.y, 74);
    equal(SpawnConfig.minBlockX, 0);
    equal(SpawnConfig.maxBlockX, 255);
    equal(SpawnConfig.minBlockZ, 0);
    equal(SpawnConfig.maxBlockZ, 255);
});

check("lighting has exactly BRIGHT and DARK states with heavy dark fog", () => {
    deepEqual(Object.keys(LightState).sort(), ["BRIGHT", "DARK"]);
    deepEqual(Object.values(LightState).sort((a, b) => a - b), [0, 1]);
    equal(LightingConfig.brightBrightness, 1);
    assert(LightingConfig.darkBrightness > 0 && LightingConfig.darkBrightness < 0.5,
        "dark brightness must remain a fixed dim value");
    assert(LightingConfig.darkFogStrength >= 0.9,
        "dark fog must remain heavy");
});

check("normal and historical proximity-processing budgets remain explicit", () => {
    assert(ChunkProcessingConfig.normal.maxChunksPerFrame >= 1,
        "normal mesh budget must be positive");
    assert(ChunkProcessingConfig.historical.maxChunksPerFrame >= 1,
        "historical mesh budget must be positive");
    assert(ChunkProcessingConfig.historical.frameInterval > ChunkProcessingConfig.normal.frameInterval,
        "historical loading must be observably slower");
});

const executableFiles = await collectExecutableFiles();
const contents = new Map();
for (const filename of executableFiles) {
    contents.set(filename, await readFile(path.join(ROOT, filename), "utf8"));
}

check("the exact clear-sky color is retained", () => {
    const app = requiredSource("web/app.mjs");
    assert(app.includes("const SKY_RED = 127 / 255"), "missing exact red sky component");
    assert(app.includes("const SKY_GREEN = 204 / 255"), "missing exact green sky component");
    assert(app.includes("const SKY_BLUE = 1"), "missing exact blue sky component");
});

check("required controls are present and no block-edit controls exist", () => {
    const player = requiredSource("web/first-person-player.mjs");
    for (const code of ["KeyW", "KeyS", "KeyA", "KeyD", "KeyR", "Space"]) {
        assert(player.includes(code), `missing control ${code}`);
    }
    assert(player.includes("mousemove"), "missing mouse-look event handling");
    assert(!player.includes("setBlock("), "player input must not edit blocks");
    assert(!player.includes("breakBlock"), "player input must not break blocks");
    assert(!player.includes("placeBlock"), "player input must not place blocks");
});

check("grass and rock use one tile on every cube face", () => {
    const mesher = requiredSource("web/chunk-mesher.mjs");
    assert(mesher.includes("blockType === BlockType.GRASS ? ATLAS_TILES.grass : ATLAS_TILES.rock"),
        "chunk mesher must choose one material solely from block type");
    assert(!/topTexture|sideTexture|bottomTexture|dirt/i.test(mesher),
        "separate face materials are prohibited");
});

check("Y=0 cave carving protection remains present", () => {
    const caves = requiredSource("web/cave-generator.mjs");
    assert(caves.includes("minimumY: 1"), "cave minimum Y must remain 1");
});

check("the player has no rendered model", () => {
    const app = requiredSource("web/app.mjs");
    assert(app.includes('playerModel: "none"'), "runtime must report no player model");
    const renderer = requiredSource("web/renderer.mjs");
    assert(!/playerMesh|handMesh|heldItem|thirdPerson/i.test(renderer),
        "renderer contains a prohibited player representation");
});

check("runtime block mutation is limited to deterministic generation and fixtures", () => {
    const permitted = new Set([
        "web/cave-generator.mjs",
        "web/terrain-generator.mjs",
        "web/test-chunk.mjs",
        "web/world.mjs",
    ]);
    const offenders = [];
    for (const [filename, source] of contents) {
        if (filename.startsWith("web/test/") || permitted.has(filename)) continue;
        if (source.includes(".setBlock(")) offenders.push(filename);
    }
    deepEqual(offenders, []);
});

check("accidental scope expansion is absent from executable source", () => {
    const forbidden = [
        ["inventory or hotbar", /\b(?:Inventory|Hotbar)\b/],
        ["crafting or recipes", /\b(?:Crafting|Recipe|Furnace)\b/],
        ["mobs or NPCs", /\b(?:Mob|Monster|Npc|NPC|Animal)\b/],
        ["survival systems", /\b(?:HealthSystem|DamageSystem|Hunger|Armor|DeathScreen|Lives)\b/],
        ["audio", /\b(?:AudioContext|HTMLAudioElement|SoundEngine|MusicPlayer)\b/],
        ["multiplayer or networking", /\b(?:WebSocket|RTCPeerConnection|Multiplayer|NetworkManager|ChatServer)\b/],
        ["saving or loading", /\b(?:saveWorld|loadWorld|serializeWorld|deserializeWorld|localStorage|indexedDB)\b/],
        ["block interaction", /\b(?:breakBlock|placeBlock|mineBlock|MiningController|BlockPicker)\b/],
        ["modern rendering", /\b(?:ShadowMap|AmbientOcclusion|PostProcess|PostProcessing|Bloom|NormalMap|PBR)\b/],
        ["extra block states", /BlockType\.(?:DIRT|WATER|SAND|ORE|BEDROCK|WOOD|TREE|LEAVES|LAVA)/],
    ];
    const offenders = [];
    for (const [filename, source] of contents) {
        if (filename.startsWith("web/test/")) continue;
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) offenders.push(`${filename}: ${label}`);
        }
    }
    deepEqual(offenders, []);
});

check("browser entry points identify the packaged Phase 12 build", () => {
    for (const filename of ["index.html", "web/index.html"]) {
        const html = requiredSource(filename);
        assert(html.includes("Phase 12"), `${filename} does not identify Phase 12`);
        assert(html.includes("phase12-runtime-metadata.mjs"), `${filename} lacks final metadata module`);
    }
});

const report = {
    audit: "cave-game-tech-test-phase-12",
    passed: failures.length === 0,
    checks: checks.length,
    failures,
    executableFilesScanned: executableFiles.length,
    permittedDeterministicFixture: "web/test-chunk.mjs",
};

if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
} else {
    for (const item of checks) console.log(`PASS  ${item}`);
    for (const item of failures) console.error(`FAIL  ${item}`);
    console.log(`\n${report.passed ? "Fidelity audit passed" : "Fidelity audit failed"}: ${checks.length - failures.length}/${checks.length} checks, ${executableFiles.length} executable files scanned.`);
}

if (!report.passed) process.exitCode = 1;

function check(name, body) {
    try {
        body();
        checks.push(name);
    } catch (error) {
        checks.push(name);
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function equal(actual, expected) {
    if (!Object.is(actual, expected)) throw new Error(`expected ${expected}, received ${actual}`);
}

function deepEqual(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
}

function requiredSource(filename) {
    const source = contents.get(filename);
    if (source === undefined) throw new Error(`missing source file ${filename}`);
    return source;
}

async function collectExecutableFiles() {
    const roots = ["web", "src/main/java"];
    const files = ["index.html", "build.gradle", "settings.gradle"];
    for (const root of roots) {
        const absolute = path.join(ROOT, root);
        try {
            if ((await stat(absolute)).isDirectory()) await walk(root, files);
        } catch {
            // A source root may be absent in a reduced package; required files fail separately.
        }
    }
    return files
        .filter(filename => /\.(?:mjs|js|java|glsl|html|gradle)$/.test(filename))
        .filter(filename => !filename.includes("/test/"))
        .sort();
}

async function walk(relativeDirectory, output) {
    const entries = await readdir(path.join(ROOT, relativeDirectory), { withFileTypes: true });
    for (const entry of entries) {
        const relative = path.join(relativeDirectory, entry.name).replaceAll(path.sep, "/");
        if (entry.isDirectory()) await walk(relative, output);
        else output.push(relative);
    }
}
