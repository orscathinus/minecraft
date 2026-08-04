import { spawn, spawnSync } from "node:child_process";
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
const TERRAIN_SEED = 1337;
const WIDTH = 1280;
const HEIGHT = 720;

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
        socket.addEventListener("close", () => {
            for (const pending of this.#pending.values()) {
                pending.reject(new Error("Chromium debugging connection closed"));
            }
            this.#pending.clear();
        });
    }

    send(method, params = {}) {
        const id = this.#nextId++;
        return new Promise((resolve, reject) => {
            this.#pending.set(id, { resolve, reject });
            this.#socket.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        this.#socket.close();
    }
}

export async function captureFinalScreenshots({ outputDirectory } = {}) {
    const output = path.resolve(outputDirectory ?? path.join(ROOT, "build/screenshots"));
    await mkdir(output, { recursive: true });

    const sceneSeeds = buildSceneSeeds();
    console.log("Screenshot scene seeds:", sceneSeeds);
    const server = await startStaticServer();
    const profile = await mkdtemp(path.join(tmpdir(), "cave-game-capture-"));
    const debugPort = await findOpenPort();
    const browser = launchChromium(debugPort, profile);

    try {
        const target = await waitForDebugTarget(debugPort, browser);
        const cdp = await CdpSession.connect(target.webSocketDebuggerUrl);
        try {
            await cdp.send("Page.enable");
            await cdp.send("Runtime.enable");
            await cdp.send("Emulation.setDeviceMetricsOverride", {
                width: WIDTH,
                height: HEIGHT,
                deviceScaleFactor: 1,
                mobile: false,
            });

            await captureSurface(cdp, server.baseUrl, output, sceneSeeds.surfaceSeed);
            await captureCave(cdp, server.baseUrl, output, sceneSeeds.caveSeed, sceneSeeds.caveSurfaceY);
            await captureChunkLoading(cdp, server.baseUrl, output, sceneSeeds.surfaceSeed);
            await captureVoid(cdp, server.baseUrl, output, sceneSeeds.edgeSeed);
        } finally {
            cdp.close();
        }
        console.log(`Captured Phase 12 screenshots in ${output}`);
    } finally {
        browser.kill("SIGTERM");
        await Promise.race([
            new Promise(resolve => browser.once("exit", resolve)),
            sleep(2_000),
        ]);
        await server.close();
        await rm(profile, { recursive: true, force: true });
    }
}

async function captureSurface(cdp, baseUrl, output, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}`);
    await waitForDataset(cdp, "appState", "running", 15_000);
    await waitForDataset(cdp, "geometry", "visible", 15_000);
    await waitForDataset(cdp, "playerGrounded", "true", 20_000);
    await sleep(400);
    await capture(cdp, output, "surface.png");
}

async function captureCave(cdp, baseUrl, output, spawnSeed, surfaceY) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}`);
    await waitForDataset(cdp, "appState", "running", 15_000);
    await waitForDataset(cdp, "geometry", "visible", 15_000);
    await waitForExpression(cdp,
        `Number(document.documentElement.dataset.playerY) < ${surfaceY - 1}`,
        20_000,
    );
    await sleep(650);
    await capture(cdp, output, "cave.png");
}

async function captureChunkLoading(cdp, baseUrl, output, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}&loading=historical&debugChunks=1`);
    await waitForDataset(cdp, "appState", "running", 15_000);
    await waitForDataset(cdp, "geometry", "visible", 15_000);
    await waitForExpression(cdp,
        `Number(document.documentElement.dataset.chunksQueued) > 0 && Number(document.documentElement.dataset.chunksVisible) >= 1`,
        10_000,
    );
    await sleep(300);
    await capture(cdp, output, "chunk-loading.png");
}

async function captureVoid(cdp, baseUrl, output, spawnSeed) {
    await navigate(cdp, `${baseUrl}/?seed=${TERRAIN_SEED}&spawnSeed=${spawnSeed}&debugChunks=1`);
    await waitForDataset(cdp, "appState", "running", 15_000);
    await waitForDataset(cdp, "geometry", "visible", 15_000);
    await waitForDataset(cdp, "playerGrounded", "true", 20_000);
    await dispatchKey(cdp, "keyDown", "s", "KeyS", 83);
    await sleep(4_500);
    await dispatchKey(cdp, "keyUp", "s", "KeyS", 83);
    await waitForDataset(cdp, "playerBelowWorld", "true", 20_000);
    await sleep(500);
    await capture(cdp, output, "void.png");
}

async function navigate(cdp, url) {
    await cdp.send("Page.navigate", { url });
    await waitForExpression(cdp, "document.readyState === 'complete'", 15_000);
}

async function capture(cdp, output, filename) {
    const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
    });
    await writeFile(path.join(output, filename), Buffer.from(result.data, "base64"));
    console.log(`Captured ${filename}`);
}

async function dispatchKey(cdp, type, key, code, virtualKeyCode) {
    await cdp.send("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode,
    });
}

async function waitForDataset(cdp, property, expected, timeout) {
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
    const state = await cdp.send("Runtime.evaluate", {
        expression: "JSON.stringify(document.documentElement.dataset)",
        returnByValue: true,
    }).catch(() => ({ result: { value: "unavailable" } }));
    throw new Error(`Timed out waiting for ${expression}; last=${last}; dataset=${state.result?.value}`);
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
    return Object.freeze({
        caveSeed: cave.seed,
        caveX: cave.x,
        caveZ: cave.z,
        caveSurfaceY: caveOpenings.get(`${cave.x},${cave.z}`),
        surfaceSeed: surface.seed,
        edgeSeed: edge.seed,
    });
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
        if (/FATAL:/.test(text)) process.stderr.write(text);
    });
    return child;
}

function findChromium() {
    for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
        const result = spawnSync("which", [candidate], { encoding: "utf8" });
        if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
    }
    throw new Error("No Chromium-based browser was found");
}

async function waitForDebugTarget(port, browser) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        if (browser.exitCode !== null) throw new Error(`Chromium exited with code ${browser.exitCode}`);
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
            if (!absolute.startsWith(`${ROOT}${path.sep}`) && absolute !== path.join(ROOT, "index.html")) {
                throw new Error("invalid path");
            }
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
