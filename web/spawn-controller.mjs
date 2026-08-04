import { WorldConfig } from "./world-config.mjs";

export const SpawnConfig = Object.freeze({
    y: 74,
    coordinateOffset: 0.5,
    minBlockX: WorldConfig.minX,
    maxBlockX: WorldConfig.maxX,
    minBlockZ: WorldConfig.minZ,
    maxBlockZ: WorldConfig.maxZ,
});

export class SpawnRandom {
    #state;

    constructor(seed) {
        if (!Number.isSafeInteger(seed)) {
            throw new TypeError("spawn random seed must be a safe integer");
        }
        this.#state = seed >>> 0;
    }

    nextUint32() {
        this.#state = (Math.imul(this.#state, 1664525) + 1013904223) >>> 0;
        return this.#state;
    }

    nextInteger(min, max) {
        if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
            throw new RangeError("spawn integer range is invalid");
        }
        const span = max - min + 1;
        return min + Math.floor(this.nextUint32() / 0x100000000 * span);
    }

    get state() { return this.#state; }
}

export class HistoricalSpawnController {
    #random;
    #seed;
    #debugSeed;
    #totalSpawns = 0;
    #respawnCount = 0;
    #lastSpawn = null;

    constructor({ debugSeed = null, sessionSeed = null } = {}) {
        if (debugSeed !== null && !Number.isSafeInteger(debugSeed)) {
            throw new TypeError("debug spawn seed must be a safe integer or null");
        }
        if (sessionSeed !== null && !Number.isSafeInteger(sessionSeed)) {
            throw new TypeError("session spawn seed must be a safe integer or null");
        }
        this.#debugSeed = debugSeed;
        this.#seed = debugSeed ?? sessionSeed ?? createSessionSeed();
        this.#random = new SpawnRandom(this.#seed);
    }

    createInitialSpawn() {
        const spawn = this.#nextSpawn();
        this.#totalSpawns += 1;
        this.#lastSpawn = spawn;
        return spawn;
    }

    respawnPlayer(playerBody) {
        if (!playerBody || typeof playerBody.respawn !== "function") {
            throw new TypeError("respawnPlayer requires a player body with respawn(position)");
        }
        const spawn = this.#nextSpawn();
        const state = playerBody.respawn(spawn.position);
        this.#totalSpawns += 1;
        this.#respawnCount += 1;
        this.#lastSpawn = spawn;
        return Object.freeze({ spawn, state });
    }

    snapshot() {
        return Object.freeze({
            seed: this.#seed,
            debugSeed: this.#debugSeed,
            source: this.#debugSeed === null ? "session-random" : "fixed-debug-seed",
            totalSpawns: this.#totalSpawns,
            respawnCount: this.#respawnCount,
            lastSpawn: this.#lastSpawn,
        });
    }

    #nextSpawn() {
        const blockX = this.#random.nextInteger(SpawnConfig.minBlockX, SpawnConfig.maxBlockX);
        const blockZ = this.#random.nextInteger(SpawnConfig.minBlockZ, SpawnConfig.maxBlockZ);
        return Object.freeze({
            blockX,
            blockZ,
            position: Object.freeze([
                blockX + SpawnConfig.coordinateOffset,
                SpawnConfig.y,
                blockZ + SpawnConfig.coordinateOffset,
            ]),
        });
    }
}

export function readSpawnDebugSeed(searchParams) {
    if (!(searchParams instanceof URLSearchParams)) {
        throw new TypeError("readSpawnDebugSeed requires URLSearchParams");
    }
    const value = searchParams.get("spawnSeed");
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function createSessionSeed() {
    const values = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(values);
        return values[0];
    }
    return Math.floor(Math.random() * 0x100000000) >>> 0;
}
