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
        if (!Number.isSafeInteger(seed)) throw new TypeError("spawn random seed must be a safe integer");
        this.#state = seed >>> 0;
    }

    nextUint32() {
        this.#state = (Math.imul(this.#state, 1664525) + 1013904223) >>> 0;
        return this.#state;
    }

    nextInteger(min, max) {
        if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError("spawn integer range is invalid");
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
    #lastBlockX = 0;
    #lastBlockZ = 0;
    #hasSpawn = false;

    constructor({ debugSeed = null, sessionSeed = null } = {}) {
        if (debugSeed !== null && !Number.isSafeInteger(debugSeed)) throw new TypeError("debug spawn seed must be a safe integer or null");
        if (sessionSeed !== null && !Number.isSafeInteger(sessionSeed)) throw new TypeError("session spawn seed must be a safe integer or null");
        this.#debugSeed = debugSeed;
        this.#seed = debugSeed ?? sessionSeed ?? createSessionSeed();
        this.#random = new SpawnRandom(this.#seed);
    }

    createInitialSpawn() {
        this.#nextCoordinates();
        this.#totalSpawns += 1;
        return this.#createSpawnSnapshot();
    }

    updateHeldFast(playerBody, held) {
        if (typeof held !== "boolean") throw new TypeError("held must be boolean");
        if (!held) return false;
        if (!playerBody || typeof playerBody.respawnXYZ !== "function") {
            return this.updateHeld(playerBody, true) !== null;
        }
        this.#nextCoordinates();
        playerBody.respawnXYZ(
            this.#lastBlockX + SpawnConfig.coordinateOffset,
            SpawnConfig.y,
            this.#lastBlockZ + SpawnConfig.coordinateOffset,
        );
        this.#totalSpawns += 1;
        this.#respawnCount += 1;
        return true;
    }

    updateHeld(playerBody, held) {
        if (typeof held !== "boolean") throw new TypeError("held must be boolean");
        return held ? this.respawnPlayer(playerBody) : null;
    }

    respawnPlayer(playerBody) {
        if (!playerBody || typeof playerBody.respawn !== "function") {
            throw new TypeError("respawnPlayer requires a player body with respawn(position)");
        }
        this.#nextCoordinates();
        const spawn = this.#createSpawnSnapshot();
        const state = playerBody.respawn(spawn.position);
        this.#totalSpawns += 1;
        this.#respawnCount += 1;
        return Object.freeze({ spawn, state });
    }

    writeSnapshot(target) {
        if (!target || typeof target !== "object") throw new TypeError("spawn snapshot target must be an object");
        target.seed = this.#seed;
        target.debugSeed = this.#debugSeed;
        target.source = this.#debugSeed === null ? "session-random" : "fixed-debug-seed";
        target.totalSpawns = this.#totalSpawns;
        target.respawnCount = this.#respawnCount;
        target.hasSpawn = this.#hasSpawn;
        target.lastBlockX = this.#lastBlockX;
        target.lastBlockZ = this.#lastBlockZ;
        target.lastX = this.#lastBlockX + SpawnConfig.coordinateOffset;
        target.lastY = SpawnConfig.y;
        target.lastZ = this.#lastBlockZ + SpawnConfig.coordinateOffset;
        return target;
    }

    snapshot() {
        const state = this.writeSnapshot({});
        state.lastSpawn = state.hasSpawn ? this.#createSpawnSnapshot() : null;
        return Object.freeze(state);
    }

    #nextCoordinates() {
        this.#lastBlockX = this.#random.nextInteger(SpawnConfig.minBlockX, SpawnConfig.maxBlockX);
        this.#lastBlockZ = this.#random.nextInteger(SpawnConfig.minBlockZ, SpawnConfig.maxBlockZ);
        this.#hasSpawn = true;
    }

    #createSpawnSnapshot() {
        return Object.freeze({
            blockX: this.#lastBlockX,
            blockZ: this.#lastBlockZ,
            position: Object.freeze([
                this.#lastBlockX + SpawnConfig.coordinateOffset,
                SpawnConfig.y,
                this.#lastBlockZ + SpawnConfig.coordinateOffset,
            ]),
        });
    }
}

export function readSpawnDebugSeed(searchParams) {
    if (!(searchParams instanceof URLSearchParams)) throw new TypeError("readSpawnDebugSeed requires URLSearchParams");
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
