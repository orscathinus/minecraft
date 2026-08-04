#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { BlockType, isOpaqueBlock } from "../web/block-type.mjs";
import { CaveGenerator } from "../web/cave-generator.mjs";
import { SeededTerrainGenerator } from "../web/terrain-generator.mjs";
import { WorldConfig } from "../web/world-config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFlag = process.argv.indexOf("--output");
const OUTPUT = path.resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] : path.join(ROOT, "build/screenshots"));
const TERRAIN_SEED = 1337;
const WIDTH = 1280;
const HEIGHT = 720;

await mkdir(OUTPUT, { recursive: true });
const sceneSeeds = buildSceneSeeds();
const server = await startStaticServer();
const profile = await mkdtemp(path.join(tmpdir(), "cave-game-capture-"));
const debugPort = await findOpenPort();
const browser = launchChromium(debugPort, profile);

try {
    const target = await waitForDebugTarget(debugPort);
    const cdp = await CdpSession.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
    });

    await captureSurface(cdp, server.baseUrl, sceneSeeds.surfaceSeed);
    await captureCave(cdp, server.baseUrl, sceneSeeds.caveSeed, sceneSeeds.caveSurfaceY);
    await captureChunkLoading(cdp, server.baseUrl, sceneSeeds.surfaceSeed);
    await captureVoid(cdp, server.baseUrl, sceneSeeds.edgeSeed);

    await cdp.close();
    console.log(`Captured Phase 12 screenshots in ${OUTPUT}`);
} finally {
    browser.kill("SIGTERM");
    await server.close();
    await rm(profile, { recursive: true, force: true });
}

async function captureSurface(cdp, baseUrl, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}`);
    await waitForDataset(cdp, "appState", "running");
    await waitForDataset(cdp, "geometry", "visible");
    await waitForDataset(cdp, "playerGrounded", "true", 12_000);
    await capture(cdp, "surface.png");
}

async function captureCave(cdp, baseUrl, spawnSeed, surfaceY) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}`);
    await waitForDataset(cdp, "appState", "running");
    await waitForDataset(cdp, "geometry", "visible");
    await waitForExpression(cdp,
        `Number(document.documentElement.dataset.playerY) < ${surfaceY - 2}`,
        12_000,
    );
    await sleep(600);
    await capture(cdp, "cave.png");
}

async function captureChunkLoading(cdp, baseUrl, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}&loading=historical&debugChunks=1`);
    await waitForDataset(cdp, "appState", "running");
    await waitForDataset(cdp, "geometry", "visible");
    await waitForExpression(cdp,
        `Number(document.documentElement.dataset.chunksQueued) > 0`,
        8_000,
    );
    await sleep(250);
    await capture(cdp, "chunk-loading.png");
}

async function captureVoid(cdp, baseUrl, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}&debugChunks=1`);
    await waitForDataset(cdp, "appState", "running");
    await waitForDataset(cdp, "geometry", "visible");
    await key(cdp, "keyDown", "s", "KeyS", 83);
    await sleep(4_000);
    await key(cdp, "keyUp", "s", "KeyS", 83);
    await waitForDataset(cdp, "playerBelowWorld", "true", 12_000);
    await sleep(350);
    await capture(cdp, "void.png");
}

async function navigate(cdp, url) {
    await cdp.send("Page.navigate", { url });
    await waitForExpression(cdp, "document.readyState === 'complete'", 10_000);
}

async function capture(cdp, filename) {
    const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
    });
    await writeFile(path.join(OUTPUT, filename), Buffer.from(result.data, "base64"));
}

async function key(cdp, type, keyValue, code, virtualKeyCode) {
    await cdp.send("Input.dispatchKeyEvent", {
        type,
        key: keyValue,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode,
    });
}

async function waitForDataset(cdp, property, expected, timeout = 10_000) {
    await waitForExpression(cdp,
        `document.documentElement.dataset.${property} === ${JSON.stringify(expected)}`,
        timeout,
    );
}

async function waitForExpression(cdp, expression, timeout) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
        const evaluation = await cdp.send("Runtime.evaluate", {
            expression,
            returnByValue: true,
        });
        last = evaluation.result?.value;
        if (last === true) return;
        await sleep(100);
    }
    throw new Error(`Timed out waiting for browser expression: ${expression}; last=${last}`);
}

function buildSceneSeeds() {
    const generator = new SeededTerrainGenerator(TERRAIN_SEED);
    const world = generator.generateWorldSync();
    new CaveGenerator(TERRAIN_SEED).carveWorldSync(world);

    const caveOpenings = new Map();
    const safeSurface = new Set();
    const safeEdge = new Set();
    for (let z = 0; z < WorldConfig.sizeZ; z += 1) {
        for (let x = 0; x < WorldConfig.sizeX; x += 1) {
            const surfaceY = generator.terrainHeight(x, z);
            const key = `${x},${z}`;
            let airDepth = 0;
            for (let y = surfaceY; y >= Math.max(1, surfaceY - 6); y -= 1) {
                if (world.getBlock(x, y, z) === BlockType.AIR) airDepth += 1;
            }
            if (world.getBlock(x, surfaceY, z) === BlockType.AIR && airDepth >= 3) {
                caveOpenings.set(key, surfaceY);
                continue;
            }
            if (isOpaqueBlock(world.getBlock(x, surfaceY, z))
                && world.getBlock(x, surfaceY + 1, z) === BlockType.AIR) {
                safeSurface.add(key);
                if (x === WorldConfig.maxX) safeEdge.add(key);
            }
        }
    }

    const cave = findSeed((x, z) => caveOpenings.has(`${x},${z}`));
    const surface = findSeed((x, z) => safeSurface.has(`${x},${z}`)
        && x >= 80 && x <= 176 && z >= 80 && z <= 176);
    const edge = findSeed((x, z) => safeEdge.has(`${x},${z}`));
    return {
        caveSeed: cave.seed,
        caveSurfaceY: caveOpenings.get(`${cave.x},${cave.z}`),
        surfaceSeed: surface.seed,
        edgeSeed: edge.seed,
    };
}

function findSeed(predicate) {
    for (let seed = 0; seed < 20_000_000; seed += 1) {
        let state = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
        const x = state >>> 24;
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const z = state >>> 24;
        if (predicate(x, z)) return { seed, x, z };
    }
    throw new Error("Unable to find deterministic screenshot spawn seed");
}

function launchChromium(port, profile) {
    const executable = process.env.CHROME_BIN || findChromium();
    const child = spawn(executable, [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        `--window-size=${WIDTH},${HEIGHT}`,
        "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", chunk => {
        const text = String(chunk);
        if (/ERROR:|FATAL:/.test(text) && !/dbus|UPower|DEPRECATED_ENDPOINT/.test(text)) {
            process.stderr.write(text);
        }
    });
    return child;
}

function findChromium() {
    const candidates = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
    return candidates.find(candidate => commandExists(candidate)) ?? "chromium";
}

function commandExists(command) {
    const pathEntries = (process.env.PATH || "").split(path.delimiter);
    return pathEntries.some(entry => {
        try {
            return Boolean(entry) && requireStat(path.join(entry, command));
        } catch {
            return false;
        }
    });
}

function requireStat(filename) {
    try {
        return globalThis.process.getBuiltinModule("node:fs").statSync(filename).isFile();
    } catch {
        return false;
    }
}

async function waitForDebugTarget(port) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        try {
            const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
            const page = targets.find(target => target.type === "page");
            if (page?.webSocketDebuggerUrl) return page;
        } catch {
            // Browser is still starting.
        }
        await sleep(100);
    }
    throw new Error("Chromium remote debugging endpoint did not start");
}

async function startStaticServer() {
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
            const absolute = path.resolve(ROOT, relative);
            if (!absolute.startsWith(ROOT)) throw new Error("invalid path");
            const body = await readFile(absolute);
            response.writeHead(200, {
                "Content-Type": mimeType(absolute),
                "Cache-Control": "no-store",
            });
            response.end(body);
        } catch {
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.end("Not found");
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(resolve => server.close(resolve)),
    };
}

function mimeType(filename) {
    if (filename.endsWith(".html")) return "text/html; charset=utf-8";
    if (filename.endsWith(".mjs") || filename.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (filename.endsWith(".css")) return "text/css; charset=utf-8";
    if (filename.endsWith(".glsl")) return "text/plain; charset=utf-8";
    if (filename.endsWith(".png")) return "image/png";
    return "application/octet-stream";
}

async function findOpenPort() {
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

class CdpSession {
    #socket;
    #nextId = 1;
    #pending = new Map();

    static async connect(url) {
        if (typeof WebSocket !== "function") {
            throw new Error("Node.js 24 or newer is required for screenshot capture");
        }
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            socket.addEventListener("open", resolve, { once: true });
            socket.addEventListener("error", reject, { once: true });
        });
        return new CdpSession(socket);
    }

    constructor(socket) {
        this.#socket = socket;
        socket.addEventListener("message", event => {
            const message = JSON.parse(String(event.data));
            if (!message.id) return;
            const pending = this.#pending.get(message.id);
            if (!pending) return;
            this.#pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message));
            else pending.resolve(message.result ?? {});
        });
    }

    send(method, params = {}) {
        const id = this.#nextId++;
        return new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject });
            this.#socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async close() {
        this.#socket.close();
    }
}
